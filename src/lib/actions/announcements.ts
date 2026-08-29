"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { ANNOUNCEMENTS_TAG } from "@/lib/announcements";
import { getDb } from "@/lib/db";
import { writeAudit } from "@/lib/security/audit";
import { announcementFormSchema, type AnnouncementFormInput } from "@/lib/validators/content";
import { fail, guardAction, ok, type ActionContext, type ActionResult } from "@/lib/actions/types";

function revalidateAnnouncements(): void {
  revalidateTag(ANNOUNCEMENTS_TAG);
  revalidatePath("/");
  revalidatePath("/admin/announcements");
}

async function audit(ctx: ActionContext, action: string, targetId: string | null, detail?: unknown): Promise<void> {
  await writeAudit({ userId: ctx.user.id, username: ctx.user.username, action, targetType: "announcement", targetId, detail, ip: ctx.ip, userAgent: ctx.userAgent });
}

function toData(input: AnnouncementFormInput) {
  return {
    content: input.content,
    linkUrl: input.linkUrl === "" ? null : input.linkUrl,
    linkText: input.linkText.trim() === "" ? null : input.linkText.trim(),
    type: input.type,
    startAt: input.startAt === "" ? null : new Date(input.startAt),
    endAt: input.endAt === "" ? null : new Date(input.endAt),
    isActive: input.isActive, isDismissible: input.isDismissible,
    priority: Number(input.priority),
  };
}

export async function createAnnouncementAction(input: unknown): Promise<ActionResult> {
  const guard = await guardAction(true);
  if (!guard.ok) return fail(guard.code);
  const parsed = announcementFormSchema().safeParse(input);
  if (!parsed.success) return fail("generic");
  const row = await getDb().announcement.create({ data: toData(parsed.data) });
  await audit(guard.ctx, "announcement.create", row.id, { content: row.content.slice(0, 80) });
  revalidateAnnouncements();
  return ok(undefined);
}

export async function updateAnnouncementAction(id: unknown, input: unknown): Promise<ActionResult> {
  const guard = await guardAction(true);
  if (!guard.ok) return fail(guard.code);
  const idParsed = z.string().cuid().safeParse(id);
  const parsed = announcementFormSchema().safeParse(input);
  if (!idParsed.success || !parsed.success) return fail("generic");
  try { await getDb().announcement.update({ where: { id: idParsed.data }, data: toData(parsed.data) }); }
  catch { return fail("generic"); }
  await audit(guard.ctx, "announcement.update", idParsed.data, { content: parsed.data.content.slice(0, 80) });
  revalidateAnnouncements();
  return ok(undefined);
}

export async function toggleAnnouncementAction(id: unknown, isActive: unknown): Promise<ActionResult> {
  const guard = await guardAction(true);
  if (!guard.ok) return fail(guard.code);
  const idParsed = z.string().cuid().safeParse(id);
  const activeParsed = z.boolean().safeParse(isActive);
  if (!idParsed.success || !activeParsed.success) return fail("generic");
  try { await getDb().announcement.update({ where: { id: idParsed.data }, data: { isActive: activeParsed.data } }); }
  catch { return fail("generic"); }
  await audit(guard.ctx, "announcement.toggle", idParsed.data, { isActive: activeParsed.data });
  revalidateAnnouncements();
  return ok(undefined);
}

export async function deleteAnnouncementAction(id: unknown): Promise<ActionResult> {
  const guard = await guardAction(true);
  if (!guard.ok) return fail(guard.code);
  const idParsed = z.string().cuid().safeParse(id);
  if (!idParsed.success) return fail("generic");
  const removed = await getDb().announcement.delete({ where: { id: idParsed.data } }).catch(() => null);
  if (removed === null) return fail("generic");
  await audit(guard.ctx, "announcement.delete", idParsed.data, { content: removed.content.slice(0, 80) });
  revalidateAnnouncements();
  return ok(undefined);
}
