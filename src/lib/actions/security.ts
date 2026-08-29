"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { revokeOtherSessions, revokeSession } from "@/lib/auth/session";
import { toCsv } from "@/lib/csv";
import { getDb } from "@/lib/db";
import { writeAudit } from "@/lib/security/audit";
import { invalidateIpBanCache } from "@/lib/security/ip-ban";
import { banIpFormSchema } from "@/lib/validators/content";
import { fail, guardAction, ok, type ActionContext, type ActionResult } from "@/lib/actions/types";

async function audit(ctx: ActionContext, action: string, targetId: string | null, detail?: unknown): Promise<void> {
  await writeAudit({ userId: ctx.user.id, username: ctx.user.username, action, targetType: "security", targetId, detail, ip: ctx.ip, userAgent: ctx.userAgent });
}

const auditFilterSchema = z.object({ action: z.string().max(64).default(""), username: z.string().max(191).default("") });

export async function exportAuditCsvAction(input: unknown): Promise<ActionResult<{ content: string }>> {
  const guard = await guardAction(true);
  if (!guard.ok) return fail(guard.code);
  const parsed = auditFilterSchema.safeParse(input);
  if (!parsed.success) return fail("generic");
  const rows = await getDb().auditLog.findMany({
    where: {
      ...(parsed.data.action !== "" ? { action: { contains: parsed.data.action } } : {}),
      ...(parsed.data.username !== "" ? { username: { contains: parsed.data.username } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 5000,
  });
  const csv = toCsv([["time", "username", "action", "targetType", "targetId", "ip", "userAgent", "detail"],
    ...rows.map((row) => [row.createdAt.toISOString(), row.username, row.action, row.targetType, row.targetId ?? "", row.ip, row.userAgent, row.detail ?? ""])]);
  await audit(guard.ctx, "security.audit_export", null, { rows: rows.length });
  return ok({ content: csv });
}

export async function revokeSessionAction(id: unknown): Promise<ActionResult> {
  const guard = await guardAction(true);
  if (!guard.ok) return fail(guard.code);
  const idParsed = z.string().cuid().safeParse(id);
  if (!idParsed.success) return fail("generic");
  const session = await getDb().session.findUnique({ where: { id: idParsed.data }, select: { userId: true, user: { select: { role: true } } } });
  if (session === null) return fail("generic");
  if (session.userId !== guard.ctx.user.id && session.user.role === "ADMIN") {
    return fail("forbidden");
  }
  await revokeSession(idParsed.data);
  await audit(guard.ctx, "security.session_revoke", idParsed.data);
  revalidatePath("/admin/security");
  return ok(undefined);
}

export async function revokeOtherSessionsAction(): Promise<ActionResult<{ count: number }>> {
  const guard = await guardAction(true);
  if (!guard.ok) return fail(guard.code);
  const count = await revokeOtherSessions(guard.ctx.user.id, guard.ctx.user.sessionId);
  await audit(guard.ctx, "security.session_revoke_others", null, { count });
  revalidatePath("/admin/security");
  return ok({ count });
}

export async function banIpAction(input: unknown): Promise<ActionResult> {
  const guard = await guardAction(true);
  if (!guard.ok) return fail(guard.code);
  const parsed = banIpFormSchema().safeParse(input);
  if (!parsed.success) return fail("generic");
  const expiresAt = parsed.data.expiresDays === "" ? null : new Date(Date.now() + Number(parsed.data.expiresDays) * 86400_000);
  const data = { reason: parsed.data.reason === "" ? null : parsed.data.reason, expiresAt, createdBy: guard.ctx.user.username };
  await getDb().ipBan.upsert({ where: { ip: parsed.data.ip }, update: data, create: { ip: parsed.data.ip, ...data } });
  invalidateIpBanCache();
  await audit(guard.ctx, "security.ip_ban", parsed.data.ip, { reason: parsed.data.reason, expiresAt: expiresAt?.toISOString() ?? null });
  revalidatePath("/admin/security");
  return ok(undefined);
}

export async function unbanIpAction(id: unknown): Promise<ActionResult> {
  const guard = await guardAction(true);
  if (!guard.ok) return fail(guard.code);
  const idParsed = z.string().cuid().safeParse(id);
  if (!idParsed.success) return fail("generic");
  const removed = await getDb().ipBan.delete({ where: { id: idParsed.data } }).catch(() => null);
  invalidateIpBanCache();
  await audit(guard.ctx, "security.ip_unban", removed?.ip ?? idParsed.data);
  revalidatePath("/admin/security");
  return ok(undefined);
}
