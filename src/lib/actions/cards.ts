"use server";

import type { PrismaClient } from "@prisma/client";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import type { CardStatus } from "@/lib/app-enums";
import { getDb } from "@/lib/db";
import { CONTENT_TAG } from "@/lib/public-data";
import { checkCardLinks } from "@/lib/link-check";
import { fetchUrlMetadata, type UrlMetadata } from "@/lib/metadata-fetch";
import { writeAudit } from "@/lib/security/audit";
import { cardFormSchema, idListSchema } from "@/lib/validators/content";
import { fail, guardAction, ok, type ActionContext, type ActionResult } from "@/lib/actions/types";

function revalidateContent(): void {
  revalidateTag(CONTENT_TAG);
  revalidatePath("/"); revalidatePath("/admin/cards"); revalidatePath("/admin/categories"); revalidatePath("/admin/trash");
}

async function audit(ctx: ActionContext, action: string, targetId: string | null, detail?: unknown): Promise<void> {
  await writeAudit({ userId: ctx.user.id, username: ctx.user.username, action, targetType: "card", targetId, detail, ip: ctx.ip, userAgent: ctx.userAgent });
}

async function syncTags(db: PrismaClient, cardId: string, rawTags: string): Promise<void> {
  const names = [...new Set(rawTags.split(",").map((n) => n.trim()).filter((n) => n.length > 0 && n.length <= 50))].slice(0, 10);
  await db.cardTag.deleteMany({ where: { cardId } });
  for (const name of names) {
    const tag = await db.tag.upsert({ where: { name }, update: {}, create: { name } });
    await db.cardTag.create({ data: { cardId, tagId: tag.id } });
  }
}

export async function createCardAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const guard = await guardAction(false);
  if (!guard.ok) return fail(guard.code);
  const parsed = cardFormSchema().safeParse(input);
  if (!parsed.success) return fail("generic");
  const db = getDb();
  const category = await db.category.findFirst({ where: { id: parsed.data.categoryId, deletedAt: null }, select: { id: true } });
  if (category === null) return fail("generic");
  const maxOrder = await db.card.aggregate({ _max: { order: true }, where: { categoryId: category.id, deletedAt: null } });
  const card = await db.card.create({
    data: {
      title: parsed.data.title, url: parsed.data.url,
      description: parsed.data.description === "" ? null : parsed.data.description,
      image: parsed.data.image === "" ? null : parsed.data.image,
      favicon: parsed.data.favicon === "" ? null : parsed.data.favicon,
      categoryId: category.id, featured: parsed.data.featured, status: parsed.data.status,
      order: (maxOrder._max.order ?? -1) + 1,
    },
  });
  await syncTags(db, card.id, parsed.data.tags);
  await audit(guard.ctx, "card.create", card.id, { title: card.title });
  revalidateContent();
  return ok({ id: card.id });
}

export async function updateCardAction(id: unknown, input: unknown): Promise<ActionResult> {
  const guard = await guardAction(false);
  if (!guard.ok) return fail(guard.code);
  const idParsed = z.string().cuid().safeParse(id);
  const parsed = cardFormSchema().safeParse(input);
  if (!idParsed.success || !parsed.success) return fail("generic");
  const db = getDb();
  const category = await db.category.findFirst({ where: { id: parsed.data.categoryId, deletedAt: null }, select: { id: true } });
  if (category === null) return fail("generic");
  try {
    await db.card.update({
      where: { id: idParsed.data },
      data: { title: parsed.data.title, url: parsed.data.url,
        description: parsed.data.description === "" ? null : parsed.data.description,
        image: parsed.data.image === "" ? null : parsed.data.image,
        favicon: parsed.data.favicon === "" ? null : parsed.data.favicon,
        categoryId: category.id, featured: parsed.data.featured, status: parsed.data.status },
    });
  } catch { return fail("generic"); }
  await syncTags(db, idParsed.data, parsed.data.tags);
  await audit(guard.ctx, "card.update", idParsed.data, { title: parsed.data.title });
  revalidateContent();
  return ok(undefined);
}

export async function softDeleteCardsAction(ids: unknown): Promise<ActionResult<{ count: number }>> {
  const guard = await guardAction(false);
  if (!guard.ok) return fail(guard.code);
  const parsed = idListSchema.safeParse(ids);
  if (!parsed.success) return fail("generic");
  const result = await getDb().card.updateMany({ where: { id: { in: parsed.data }, deletedAt: null }, data: { deletedAt: new Date() } });
  await audit(guard.ctx, "card.bulk_delete", null, { count: result.count });
  revalidateContent();
  return ok({ count: result.count });
}

export async function restoreCardsAction(ids: unknown): Promise<ActionResult<{ count: number }>> {
  const guard = await guardAction(false);
  if (!guard.ok) return fail(guard.code);
  const parsed = idListSchema.safeParse(ids);
  if (!parsed.success) return fail("generic");
  const db = getDb();
  const candidates = await db.card.findMany({ where: { id: { in: parsed.data }, deletedAt: { not: null }, category: { deletedAt: null } }, select: { id: true } });
  if (candidates.length === 0) return ok({ count: 0 });
  const restorableIds = candidates.map((c) => c.id);
  const result = await db.card.updateMany({ where: { id: { in: restorableIds } }, data: { deletedAt: null } });
  await audit(guard.ctx, "card.restore", null, { count: result.count, skippedNoCategory: parsed.data.length - result.count });
  revalidateContent();
  return ok({ count: result.count });
}

export async function purgeCardsAction(ids: unknown): Promise<ActionResult<{ count: number }>> {
  const guard = await guardAction(false);
  if (!guard.ok) return fail(guard.code);
  const parsed = idListSchema.safeParse(ids);
  if (!parsed.success) return fail("generic");
  const result = await getDb().card.deleteMany({ where: { id: { in: parsed.data }, deletedAt: { not: null } } });
  await audit(guard.ctx, "card.purge", null, { count: result.count });
  revalidateContent();
  return ok({ count: result.count });
}

export async function emptyTrashAction(): Promise<ActionResult<{ count: number }>> {
  const guard = await guardAction(false);
  if (!guard.ok) return fail(guard.code);
  const db = getDb();
  const count = await db.$transaction(async (tx) => {
    const cards = await tx.card.deleteMany({ where: { deletedAt: { not: null } } });
    await tx.category.deleteMany({ where: { deletedAt: { not: null } } });
    return cards.count;
  });
  await audit(guard.ctx, "trash.empty", null, { count });
  revalidateContent();
  return ok({ count });
}

export async function reorderCardsAction(categoryId: unknown, orderedIds: unknown): Promise<ActionResult> {
  const guard = await guardAction(false);
  if (!guard.ok) return fail(guard.code);
  const categoryParsed = z.string().cuid().safeParse(categoryId);
  const idsParsed = idListSchema.safeParse(orderedIds);
  if (!categoryParsed.success || !idsParsed.success) return fail("generic");
  if (idsParsed.data.length === 0) return fail("generic");
  // Atomic: updateMany constrains by categoryId so IDs from another category can't be smuggled in.
  // Use a small per-index transaction so a partial failure rolls back; the WHERE clause re-validates
  // membership on every update.
  const db = getDb();
  try {
    await db.$transaction(
      idsParsed.data.map((id, index) =>
        db.card.updateMany({
          where: { id, categoryId: categoryParsed.data },
          data: { order: index },
        })
      )
    );
  } catch {
    return fail("generic");
  }
  await audit(guard.ctx, "card.reorder", null, { categoryId: categoryParsed.data, count: idsParsed.data.length });
  revalidateContent();
  return ok(undefined);
}

export async function bulkSetCategoryAction(ids: unknown, categoryId: unknown): Promise<ActionResult<{ count: number }>> {
  const guard = await guardAction(true);
  if (!guard.ok) return fail(guard.code);
  const idsParsed = idListSchema.safeParse(ids);
  const categoryParsed = z.string().cuid().safeParse(categoryId);
  if (!idsParsed.success || !categoryParsed.success) return fail("generic");
  const db = getDb();
  const category = await db.category.findFirst({ where: { id: categoryParsed.data, deletedAt: null }, select: { id: true } });
  if (category === null) return fail("generic");
  const result = await db.card.updateMany({ where: { id: { in: idsParsed.data }, deletedAt: null }, data: { categoryId: category.id } });
  await audit(guard.ctx, "card.bulk_set_category", null, { count: result.count, categoryId: category.id });
  revalidateContent();
  return ok({ count: result.count });
}

export async function bulkSetFeaturedAction(ids: unknown, featured: unknown): Promise<ActionResult<{ count: number }>> {
  const guard = await guardAction(true);
  if (!guard.ok) return fail(guard.code);
  const idsParsed = idListSchema.safeParse(ids);
  const featuredParsed = z.boolean().safeParse(featured);
  if (!idsParsed.success || !featuredParsed.success) return fail("generic");
  const result = await getDb().card.updateMany({ where: { id: { in: idsParsed.data }, deletedAt: null }, data: { featured: featuredParsed.data } });
  await audit(guard.ctx, featuredParsed.data ? "card.bulk_feature" : "card.bulk_unfeature", null, { count: result.count });
  revalidateContent();
  return ok({ count: result.count });
}

export async function bulkSetStatusAction(ids: unknown, status: unknown): Promise<ActionResult<{ count: number }>> {
  const guard = await guardAction(false);
  if (!guard.ok) return fail(guard.code);
  const idsParsed = idListSchema.safeParse(ids);
  const statusParsed = z.enum(["DRAFT", "PUBLISHED"]).safeParse(status);
  if (!idsParsed.success || !statusParsed.success) return fail("generic");
  const result = await getDb().card.updateMany({ where: { id: { in: idsParsed.data }, deletedAt: null }, data: { status: statusParsed.data as CardStatus } });
  await audit(guard.ctx, statusParsed.data === "PUBLISHED" ? "card.bulk_publish" : "card.bulk_unpublish", null, { count: result.count });
  revalidateContent();
  return ok({ count: result.count });
}

export async function fetchUrlMetadataAction(url: unknown): Promise<ActionResult<UrlMetadata>> {
  const guard = await guardAction(false);
  if (!guard.ok) return fail(guard.code);
  const parsed = z.string().url().max(2048).safeParse(url);
  if (!parsed.success) return fail("fetchFailed");
  const metadata = await fetchUrlMetadata(parsed.data);
  if (metadata === null) return fail("fetchFailed");
  return ok(metadata);
}

export interface LinkCheckSummary { ok: number; broken: number }

export async function checkLinksAction(ids: unknown): Promise<ActionResult<LinkCheckSummary>> {
  const guard = await guardAction(false);
  if (!guard.ok) return fail(guard.code);
  const parsed = z.array(z.string().cuid()).min(1).max(25).safeParse(ids);
  if (!parsed.success) return fail("generic");
  const db = getDb();
  const cards = await db.card.findMany({ where: { id: { in: parsed.data }, deletedAt: null }, select: { id: true, url: true } });
  const results = await checkCardLinks(cards);
  const now = new Date();
  await db.$transaction(results.map((r) => db.card.update({ where: { id: r.id }, data: { linkStatus: r.ok ? "OK" : "BROKEN", lastCheckedAt: now } })));
  const summary: LinkCheckSummary = { ok: results.filter((r) => r.ok).length, broken: results.filter((r) => !r.ok).length };
  await audit(guard.ctx, "card.link_check", null, summary);
  revalidatePath("/admin/cards");
  return ok(summary);
}
