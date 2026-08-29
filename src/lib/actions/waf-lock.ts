"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import bcryptjs from "bcryptjs";
import { headers } from "next/headers";
import { getDb } from "@/lib/db";
import { checkRate, rateRules } from "@/lib/security/rate-limit";
import { writeAudit } from "@/lib/security/audit";
import { fail, guardAction, ok, type ActionResult } from "@/lib/actions/types";
import { setWafConfig, getAdminLockUntil } from "@/lib/waf/admin-lock";
import { getClientIdentifier, getClientIp } from "@/lib/security/ip";
import { isIpBanned } from "@/lib/security/ip-ban";

const lockSchema = z.object({
  minutes: z.coerce.number().int().min(1).max(7 * 24 * 60),
});

export async function lockAdminAction(input: unknown): Promise<ActionResult> {
  const guard = await guardAction(true);
  if (!guard.ok) return fail(guard.code);
  const parsed = lockSchema.safeParse(input);
  if (!parsed.success) return fail("generic");
  const until = new Date(Date.now() + parsed.data.minutes * 60_000).toISOString();
  await setWafConfig("adminLockUntil", until);
  await writeAudit({
    userId: guard.ctx.user.id,
    username: guard.ctx.user.username,
    action: "waf.admin_lock",
    targetType: "waf",
    detail: { minutes: parsed.data.minutes, until },
    ip: guard.ctx.ip,
    userAgent: guard.ctx.userAgent,
  });
  revalidatePath("/admin", "layout");
  return ok(undefined);
}

const unlockSchema = z.object({
  password: z.string().min(1).max(128),
});

// Unlock brute-force defense: the unlock endpoint checks the ADMIN password with no
// session, so it needs its own failure lock — the generic rate limiter alone would let
// an attacker grind guesses forever at the allowed rate.
const UNLOCK_MAX_FAILURES = 5;
const UNLOCK_LOCK_MS = 15 * 60_000;
const globalForUnlockLock = globalThis as unknown as { unlockFailures?: Map<string, { count: number; until: number }> };
const unlockFailures = (globalForUnlockLock.unlockFailures ??= new Map());

function unlockLocked(key: string): boolean {
  const entry = unlockFailures.get(key);
  if (entry === undefined) return false;
  if (entry.until <= Date.now()) {
    unlockFailures.delete(key);
    return false;
  }
  return true;
}

function recordUnlockFailure(key: string): void {
  const entry = unlockFailures.get(key);
  if (entry === undefined || entry.until <= Date.now()) {
    unlockFailures.set(key, { count: 1, until: Date.now() + UNLOCK_LOCK_MS });
  } else {
    entry.count += 1;
    if (entry.count >= UNLOCK_MAX_FAILURES) {
      entry.until = Date.now() + UNLOCK_LOCK_MS;
      entry.count = 0;
    }
  }
}

// Early unlock from lock page: admin password check + login rate limit (no session)
export async function unlockEarlyAction(input: unknown): Promise<ActionResult> {
  const headerStore = await headers();
  const clientKey = await getClientIdentifier(headerStore);
  const ip = getClientIp(headerStore);
  // Ban check uses the raw IP (not the per-browser cookie) so bans survive cookie clears.
  if (await isIpBanned(ip)) return fail("forbidden");
  const rate = await checkRate("login", clientKey);
  if (!rate.ok) return fail("rateLimited");
  if (unlockLocked(clientKey)) return fail("rateLimited");

  const parsed = unlockSchema.safeParse(input);
  if (!parsed.success) return fail("generic");

  // Require an active lock for this endpoint
  const until = await getAdminLockUntil();
  if (until === null) return fail("generic");

  const db = getDb();
  const admin = await db.user.findFirst({ where: { role: "ADMIN", isActive: true } });
  if (admin === null) return fail("generic");
  const okPass = await bcryptjs.compare(parsed.data.password, admin.passwordHash);
  if (!okPass) {
    recordUnlockFailure(clientKey);
    await writeAudit({
      userId: admin.id,
      username: admin.username,
      action: "waf.unlock_failed",
      targetType: "waf",
      ip: clientKey,
      userAgent: headerStore.get("user-agent") ?? "",
    });
    return fail("invalid");
  }
  unlockFailures.delete(clientKey);
  await setWafConfig("adminLockUntil", "");
  await writeAudit({
    userId: admin.id,
    username: admin.username,
    action: "waf.unlock_early",
    targetType: "waf",
    ip: clientKey,
    userAgent: headerStore.get("user-agent") ?? "",
  });
  revalidatePath("/admin", "layout");
  return ok(undefined);
}

void rateRules;
