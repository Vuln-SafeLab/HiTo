"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { writeAudit } from "@/lib/security/audit";
import { fail, guardAction, ok, type ActionContext, type ActionResult } from "@/lib/actions/types";
import { headers } from "next/headers";
import { getKunBansSnapshot, getWafRuntimeConfig, setWafConfig } from "@/lib/waf/config";

async function audit(ctx: ActionContext, action: string, detail?: unknown): Promise<void> {
  await writeAudit({ userId: ctx.user.id, username: ctx.user.username, action, targetType: "waf", detail, ip: ctx.ip, userAgent: ctx.userAgent });
}

const runtimeConfigSchema = z.object({
  mode: z.enum(["off", "log", "block"]),
  underAttackQps: z.coerce.number().int().min(1).max(100_000),
  challengeTtl: z.coerce.number().int().min(30).max(86_400),
  windowLimit: z.coerce.number().int().min(10).max(100_000),
});

export async function saveWafRuntimeConfigAction(input: unknown): Promise<ActionResult> {
  const guard = await guardAction(true);
  if (!guard.ok) return fail(guard.code);
  const parsed = runtimeConfigSchema.safeParse(input);
  if (!parsed.success) return fail("generic");
  const { mode, underAttackQps, challengeTtl, windowLimit } = parsed.data;
  try {
    await setWafConfig("mode", mode);
    await setWafConfig("underAttackQps", String(underAttackQps));
    await setWafConfig("challengeTtl", String(challengeTtl));
    await setWafConfig("windowLimit", String(windowLimit));
  } catch { return fail("generic"); }
  await audit(guard.ctx, "waf.config_save", { mode, underAttackQps, challengeTtl, windowLimit });
  revalidatePath("/admin/security");
  return ok(undefined);
}

const toggleSchema = z.object({ entry: z.string().min(1).max(120), disabled: z.boolean() });

export async function toggleWafRuleAction(input: unknown): Promise<ActionResult> {
  const guard = await guardAction(true);
  if (!guard.ok) return fail(guard.code);
  const parsed = toggleSchema.safeParse(input);
  if (!parsed.success) return fail("generic");
  try {
    const config = await getWafRuntimeConfig();
    const set = new Set(config.rulesDisabled);
    if (parsed.data.disabled) set.add(parsed.data.entry); else set.delete(parsed.data.entry);
    await setWafConfig("rulesDisabled", JSON.stringify(Array.from(set)));
  } catch { return fail("generic"); }
  await audit(guard.ctx, "waf.rule_toggle", parsed.data);
  revalidatePath("/admin/security");
  return ok(undefined);
}

const manualAttackSchema = z.object({ minutes: z.coerce.number().int().min(1).max(1440) });

export async function manualUnderAttackAction(input: unknown): Promise<ActionResult> {
  const guard = await guardAction(true);
  if (!guard.ok) return fail(guard.code);
  const parsed = manualAttackSchema.safeParse(input);
  if (!parsed.success) return fail("generic");
  await setWafConfig("attackModeUntil", new Date(Date.now() + parsed.data.minutes * 60_000).toISOString());
  await audit(guard.ctx, "waf.manual_under_attack", { minutes: parsed.data.minutes });
  revalidatePath("/admin/security");
  return ok(undefined);
}

export async function stopManualUnderAttackAction(): Promise<ActionResult> {
  const guard = await guardAction(true);
  if (!guard.ok) return fail(guard.code);
  await setWafConfig("attackModeUntil", "");
  await audit(guard.ctx, "waf.stop_under_attack");
  revalidatePath("/admin/security");
  return ok(undefined);
}

const releaseSchema = z.object({ ipKeys: z.array(z.string().min(1).max(80)).min(1).max(20) });

export async function releaseKunBansAction(input: unknown): Promise<ActionResult<{ released: number }>> {
  const guard = await guardAction(true);
  if (!guard.ok) return fail(guard.code);
  const parsed = releaseSchema.safeParse(input);
  if (!parsed.success) return fail("generic");
  const snapshot = await getKunBansSnapshot();
  const valid = new Set(snapshot.map((e) => e.ipKey));
  const targets = parsed.data.ipKeys.filter((k) => valid.has(k));
  if (targets.length === 0) return fail("generic");
  const seq = Date.now();
  for (const [index, ipKey] of targets.entries()) {
    await setWafConfig(`banRelease.${seq}.${index}`, JSON.stringify({ ipKey, seq }));
  }
  await audit(guard.ctx, "waf.kun_ban_release", { count: targets.length, ipKeys: targets.slice(0, 5) });
  revalidatePath("/admin/security");
  return ok({ released: targets.length });
}

const ackSchema = z.object({ ids: z.array(z.string()).max(500).optional() });

export async function acknowledgeWafEventsAction(input: unknown): Promise<ActionResult<{ acked: number }>> {
  const { getSessionUser } = await import("@/lib/auth/guard");
  const user = await getSessionUser();
  if (user === null || user.role !== "ADMIN") return fail("unauthorized");
  const parsed = ackSchema.safeParse(input ?? {});
  if (!parsed.success) return fail("generic");
  try {
    const idIn = parsed.data.ids !== undefined && parsed.data.ids.length > 0 ? parsed.data.ids.map(Number).filter(Number.isFinite) : undefined;
    const where = idIn !== undefined ? { acknowledgedAt: null, id: { in: idIn } } : { acknowledgedAt: null };
    const result = await getDb().wafEvent.updateMany({ where, data: { acknowledgedAt: new Date() } });
    const headerStore = await headers();
    await writeAudit({
      userId: user.id, username: user.username, action: "waf.events_ack", targetType: "waf",
      detail: { acked: result.count }, ip: headerStore.get("x-forwarded-for") ?? "", userAgent: headerStore.get("user-agent") ?? "",
    });
    revalidatePath("/admin/security");
    return ok({ acked: result.count });
  } catch { return fail("generic"); }
}

export async function clearWafLogsAction(): Promise<ActionResult<{ deleted: number }>> {
  const guard = await guardAction(true);
  if (!guard.ok) return fail(guard.code);
  try {
    const result = await getDb().wafEvent.deleteMany({});
    await audit(guard.ctx, "waf.logs_clear", { deleted: result.count });
    revalidatePath("/admin/security");
    return ok({ deleted: result.count });
  } catch { return fail("generic"); }
}

export async function pruneOldWafEventsAction(): Promise<ActionResult<{ deleted: number }>> {
  const guard = await guardAction(true);
  if (!guard.ok) return fail(guard.code);
  try {
    const cutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const result = await getDb().wafEvent.deleteMany({ where: { at: { lt: cutoff } } });
    await audit(guard.ctx, "waf.logs_prune", { deleted: result.count });
    revalidatePath("/admin/security");
    return ok({ deleted: result.count });
  } catch { return fail("generic"); }
}
