"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { ADS_TAG } from "@/lib/ads";
import { getDb } from "@/lib/db";
import { writeAudit } from "@/lib/security/audit";
import { adFormSchema, adVerificationFormSchema, type AdFormInput, type AdVerificationFormInput } from "@/lib/validators/ads";
import { fail, guardAction, ok, type ActionContext, type ActionResult } from "@/lib/actions/types";

function revalidateAds(): void {
  revalidateTag(ADS_TAG);
  revalidatePath("/");
  revalidatePath("/admin/ads");
  revalidatePath("/admin/ads/verifications");
}

async function audit(ctx: ActionContext, action: string, targetType: string, targetId: string | null, detail?: unknown): Promise<void> {
  await writeAudit({ userId: ctx.user.id, username: ctx.user.username, action, targetType, targetId, detail, ip: ctx.ip, userAgent: ctx.userAgent });
}

function adData(input: AdFormInput) {
  return {
    provider: input.provider.trim(), alias: input.alias.trim(), position: input.position, type: input.type,
    code: input.code, isActive: input.isActive, weight: Number(input.weight), device: input.device,
    startAt: input.startAt === "" ? null : new Date(input.startAt),
    endAt: input.endAt === "" ? null : new Date(input.endAt),
  };
}

export async function createAdAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const guard = await guardAction(true);
  if (!guard.ok) return fail(guard.code);
  const parsed = adFormSchema().safeParse(input);
  if (!parsed.success) return fail("generic");
  const row = await getDb().advertisement.create({ data: adData(parsed.data) });
  await audit(guard.ctx, "advertisement.create", "advertisement", row.id, { provider: row.provider, alias: row.alias, position: row.position });
  revalidateAds();
  return ok({ id: row.id });
}

export async function updateAdAction(id: unknown, input: unknown): Promise<ActionResult> {
  const guard = await guardAction(true);
  if (!guard.ok) return fail(guard.code);
  const idParsed = z.string().cuid().safeParse(id);
  const parsed = adFormSchema().safeParse(input);
  if (!idParsed.success || !parsed.success) return fail("generic");
  try { await getDb().advertisement.update({ where: { id: idParsed.data }, data: adData(parsed.data) }); }
  catch { return fail("generic"); }
  await audit(guard.ctx, "advertisement.update", "advertisement", idParsed.data, { provider: parsed.data.provider, alias: parsed.data.alias, position: parsed.data.position });
  revalidateAds();
  return ok(undefined);
}

export async function toggleAdAction(id: unknown, isActive: unknown): Promise<ActionResult> {
  const guard = await guardAction(true);
  if (!guard.ok) return fail(guard.code);
  const idParsed = z.string().cuid().safeParse(id);
  const activeParsed = z.boolean().safeParse(isActive);
  if (!idParsed.success || !activeParsed.success) return fail("generic");
  try { await getDb().advertisement.update({ where: { id: idParsed.data }, data: { isActive: activeParsed.data } }); }
  catch { return fail("generic"); }
  await audit(guard.ctx, "advertisement.toggle", "advertisement", idParsed.data, { isActive: activeParsed.data });
  revalidateAds();
  return ok(undefined);
}

export async function deleteAdAction(id: unknown): Promise<ActionResult> {
  const guard = await guardAction(true);
  if (!guard.ok) return fail(guard.code);
  const idParsed = z.string().cuid().safeParse(id);
  if (!idParsed.success) return fail("generic");
  try { await getDb().advertisement.delete({ where: { id: idParsed.data } }); }
  catch { return fail("generic"); }
  await audit(guard.ctx, "advertisement.delete", "advertisement", idParsed.data);
  revalidateAds();
  return ok(undefined);
}

function verificationData(input: AdVerificationFormInput) {
  return {
    provider: input.provider.trim(),
    metaName: input.metaName === "" ? null : input.metaName,
    metaContent: input.metaContent === "" ? null : input.metaContent,
    fileName: input.fileName === "" ? null : input.fileName,
    fileContent: input.fileContent === "" ? null : input.fileContent,
    dnsType: input.dnsType === "" ? null : input.dnsType,
    dnsHost: input.dnsHost === "" ? null : input.dnsHost,
    dnsValue: input.dnsValue === "" ? null : input.dnsValue,
    dnsNote: input.dnsNote === "" ? null : input.dnsNote,
    isActive: input.isActive,
  };
}

export async function saveAdVerificationAction(id: string | null, input: unknown): Promise<ActionResult<{ id: string }>> {
  const guard = await guardAction(true);
  if (!guard.ok) return fail(guard.code);
  const parsed = adVerificationFormSchema().safeParse(input);
  if (!parsed.success) return fail("generic");
  const data = verificationData(parsed.data);
  const row = id === null
    ? await getDb().adVerification.create({ data })
    : await getDb().adVerification.update({ where: { id }, data });
  await audit(guard.ctx, id === null ? "adVerification.create" : "adVerification.update", "adVerification", row.id, { provider: row.provider });
  revalidateAds();
  return ok({ id: row.id });
}

export async function toggleAdVerificationAction(id: unknown, isActive: unknown): Promise<ActionResult> {
  const guard = await guardAction(true);
  if (!guard.ok) return fail(guard.code);
  const idParsed = z.string().cuid().safeParse(id);
  const activeParsed = z.boolean().safeParse(isActive);
  if (!idParsed.success || !activeParsed.success) return fail("generic");
  try { await getDb().adVerification.update({ where: { id: idParsed.data }, data: { isActive: activeParsed.data } }); }
  catch { return fail("generic"); }
  await audit(guard.ctx, "adVerification.toggle", "adVerification", idParsed.data, { isActive: activeParsed.data });
  revalidateAds();
  return ok(undefined);
}

export async function deleteAdVerificationAction(id: unknown): Promise<ActionResult> {
  const guard = await guardAction(true);
  if (!guard.ok) return fail(guard.code);
  const idParsed = z.string().cuid().safeParse(id);
  if (!idParsed.success) return fail("generic");
  try { await getDb().adVerification.delete({ where: { id: idParsed.data } }); }
  catch { return fail("generic"); }
  await audit(guard.ctx, "adVerification.delete", "adVerification", idParsed.data);
  revalidateAds();
  return ok(undefined);
}
