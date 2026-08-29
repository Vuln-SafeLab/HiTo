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

// Early unlock from lock page: admin password check + login rate limit (no session)
export async function unlockEarlyAction(input: unknown): Promise<ActionResult> {
  const headerStore = await headers();
  const clientKey = await getClientIdentifier(headerStore);
  const ip = getClientIp(headerStore);
  // Ban check uses the raw IP (not the per-browser cookie) so bans survive cookie clears.
  if (await isIpBanned(ip)) return fail("forbidden");
  const rate = await checkRate("login", clientKey);
  if (!rate.ok) return fail("rateLimited");

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
