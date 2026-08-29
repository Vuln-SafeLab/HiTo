"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { clearAuthCookies, setAuthCookies } from "@/lib/auth/cookies";
import { getSessionUser } from "@/lib/auth/guard";
import { clearLoginLock, isLoginLocked, recordLoginFailure } from "@/lib/auth/login-lock";
import { signAccessToken } from "@/lib/auth/jwt";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, revokeSession } from "@/lib/auth/session";
import type { Role } from "@/lib/app-enums";
import { getDb } from "@/lib/db";
import { writeAudit } from "@/lib/security/audit";
import { getClientIdentifier, getClientIp } from "@/lib/security/ip";
import { isIpBanned } from "@/lib/security/ip-ban";
import { checkRate } from "@/lib/security/rate-limit";
import { fail, ok, type ActionResult } from "@/lib/actions/types";

const loginSchema = z.object({ username: z.string().min(1).max(191), password: z.string().min(1).max(128) });

const IP_LOCK_MS = 30 * 60 * 1000;
const IP_MAX_FAILURES = 30;
const ipFailureCache = new Map<string, { count: number; until: number }>();

function cleanIpCache(): void {
  const now = Date.now();
  for (const [k, v] of ipFailureCache) {
    if (v.until <= now) ipFailureCache.delete(k);
    else if (v.count === 0) ipFailureCache.delete(k);
  }
}

// With TRUST_PROXY=false every client shares the "direct" key: a per-IP lock would
// let one attacker DoS login for ALL visitors. Only apply it when the IP is
// attributable (TRUST_PROXY=true); otherwise per-username locks + rate limiting carry the load.
function ipLockEnabled(): boolean {
  return process.env.TRUST_PROXY === "true";
}

function isIpGloballyLocked(ip: string): boolean {
  if (!ipLockEnabled()) return false;
  cleanIpCache();
  const entry = ipFailureCache.get(ip);
  if (entry !== undefined && entry.count >= IP_MAX_FAILURES && entry.until > Date.now()) return true;
  return false;
}

function recordIpFailure(ip: string): void {
  if (!ipLockEnabled()) return;
  cleanIpCache();
  const existing = ipFailureCache.get(ip);
  if (existing !== undefined) {
    existing.count += 1;
  } else {
    ipFailureCache.set(ip, { count: 1, until: Date.now() + IP_LOCK_MS });
  }
}

function clearIpFailure(ip: string): void {
  ipFailureCache.delete(ip);
}

export async function loginAction(input: unknown): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return fail("generic");
  const headerStore = await headers();
  const clientKey = await getClientIdentifier(headerStore);
  const ip = getClientIp(headerStore);
  const userAgent = headerStore.get("user-agent") ?? "";
  if (await isIpBanned(ip)) return fail("forbidden");
  // Per-IP cumulative lockout: blocks an attacker from trying many usernames in sequence
  // to enumerate accounts or DoS a victim. Distinct from the per-username 10-failure lock.
  if (isIpGloballyLocked(ip)) return fail("locked");
  const rate = await checkRate("login", clientKey);
  if (!rate.ok) return fail("rateLimited");
  const attemptIdentifiers = [parsed.data.username];
  if (await isLoginLocked(attemptIdentifiers)) {
    recordIpFailure(ip);
    await writeAudit({ username: parsed.data.username.slice(0, 191), action: "auth.login_locked", targetType: "auth", ip: clientKey, userAgent });
    return fail("locked");
  }
  const db = getDb();
  const user = await db.user.findFirst({ where: { OR: [{ username: parsed.data.username }, { email: parsed.data.username }] } });
  if (user === null) {
    await hashPassword(parsed.data.password);
    await recordLoginFailure(attemptIdentifiers);
    recordIpFailure(ip);
    await writeAudit({ username: parsed.data.username.slice(0, 191), action: "auth.login_failed", targetType: "auth", ip: clientKey, userAgent });
    return fail("invalid");
  }
  const passwordOk = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!passwordOk) {
    await recordLoginFailure([...attemptIdentifiers, user.username, user.email]);
    recordIpFailure(ip);
    await writeAudit({ userId: user.id, username: user.username, action: "auth.login_failed", targetType: "auth", ip: clientKey, userAgent });
    return fail("invalid");
  }
  if (!user.isActive) return fail("disabled");
  const { getAdminLockUntil } = await import("@/lib/waf/admin-lock");
  const lockUntil = await getAdminLockUntil();
  if (lockUntil !== null) return fail("adminLocked");
  await clearLoginLock([...attemptIdentifiers, user.username, user.email]);
  clearIpFailure(ip);
  const { refreshToken, session } = await createSession(user.id, clientKey, userAgent);
  const accessToken = await signAccessToken({ sub: user.id, sid: session.id, role: user.role as Role });
  await setAuthCookies(accessToken, refreshToken);
  await writeAudit({ userId: user.id, username: user.username, action: "auth.login", targetType: "auth", targetId: session.id, ip: clientKey, userAgent });
  return ok(undefined);
}

export async function logoutAction(): Promise<void> {
  const user = await getSessionUser();
  if (user !== null) {
    await revokeSession(user.sessionId);
    const headerStore = await headers();
    await writeAudit({
      userId: user.id, username: user.username, action: "auth.logout", targetType: "auth", targetId: user.sessionId,
      ip: await getClientIdentifier(headerStore), userAgent: headerStore.get("user-agent") ?? "",
    });
  }
  await clearAuthCookies();
  redirect("/admin/login");
}
