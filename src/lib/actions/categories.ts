"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { CONTENT_TAG } from "@/lib/public-data";
import { writeAudit } from "@/lib/security/audit";
import { categoryFormSchema, idListSchema } from "@/lib/validators/content";
import { fail, guardAction, ok, type ActionContext, type ActionResult } from "@/lib/actions/types";

function revalidateContent(): void {
  revalidateTag(CONTENT_TAG);
  revalidatePath("/");
  revalidatePath("/admin/categories");
  revalidatePath("/admin/cards");
  revalidatePath("/admin/trash");
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

async function audit(ctx: ActionContext, action: string, targetId: string | null, detail?: unknown): Promise<void> {
  await writeAudit({ userId: ctx.user.id, username: ctx.user.username, action, targetType: "category", targetId, detail, ip: ctx.ip, userAgent: ctx.userAgent });
}

export async function createCategoryAction(input: unknown): Promise<ActionResult> {
  const guard = await guardAction(false);
  if (!guard.ok) return fail(guard.code);
  const parsed = categoryFormSchema().safeParse(input);
  if (!parsed.success) return fail("generic");
  const db = getDb();
  try {
    const maxOrder = await db.category.aggregate({ _max: { order: true } });
    const category = await db.category.create({
      data: {
        name: parsed.data.name, slug: parsed.data.slug, icon: parsed.data.icon,
        description: parsed.data.description === "" ? null : parsed.data.description,
        order: (maxOrder._max.order ?? -1) + 1,
      },
    });
    await audit(guard.ctx, "category.create", category.id, { name: category.name, slug: category.slug });
  } catch (error) {
    return fail(isUniqueViolation(error) ? "slugTaken" : "generic");
  }
  revalidateContent();
  return ok(undefined);
}

export async function updateCategoryAction(id: unknown, input: unknown): Promise<ActionResult> {
  const guard = await guardAction(false);
  if (!guard.ok) return fail(guard.code);
  const idParsed = z.string().cuid().safeParse(id);
  const parsed = categoryFormSchema().safeParse(input);
  if (!idParsed.success || !parsed.success) return fail("generic");
  try {
    await getDb().category.update({
      where: { id: idParsed.data },
      data: { name: parsed.data.name, slug: parsed.data.slug, icon: parsed.data.icon, description: parsed.data.description === "" ? null : parsed.data.description },
    });
    await audit(guard.ctx, "category.update", idParsed.data, { name: parsed.data.name });
  } catch (error) {
    return fail(isUniqueViolation(error) ? "slugTaken" : "generic");
  }
  revalidateContent();
  return ok(undefined);
}

export async function softDeleteCategoryAction(id: unknown): Promise<ActionResult> {
  const guard = await guardAction(false);
  if (!guard.ok) return fail(guard.code);
  const idParsed = z.string().cuid().safeParse(id);
  if (!idParsed.success) return fail("generic");
  const db = getDb();
  // Reject if any live cards still reference this category
  const activeCards = await db.card.count({ where: { categoryId: idParsed.data, deletedAt: null } });
  if (activeCards > 0) return fail("categoryNotEmpty");
  await db.category.update({ where: { id: idParsed.data }, data: { deletedAt: new Date() } });
  await audit(guard.ctx, "category.delete", idParsed.data);
  revalidateContent();
  return ok(undefined);
}

export async function restoreCategoryAction(id: unknown): Promise<ActionResult> {
  const guard = await guardAction(false);
  if (!guard.ok) return fail(guard.code);
  const idParsed = z.string().cuid().safeParse(id);
  if (!idParsed.success) return fail("generic");
  await getDb().category.update({ where: { id: idParsed.data }, data: { deletedAt: null } });
  await audit(guard.ctx, "category.restore", idParsed.data);
  revalidateContent();
  return ok(undefined);
}

export async function purgeCategoryAction(id: unknown): Promise<ActionResult> {
  const guard = await guardAction(false);
  if (!guard.ok) return fail(guard.code);
  const idParsed = z.string().cuid().safeParse(id);
  if (!idParsed.success) return fail("generic");
  try {
    // Only purge categories already in trash; FK Restrict blocks those still referenced
    await getDb().category.delete({ where: { id: idParsed.data, deletedAt: { not: null } } });
  } catch { return fail("categoryNotEmpty"); }
  await audit(guard.ctx, "category.purge", idParsed.data);
  revalidateContent();
  return ok(undefined);
}

export async function reorderCategoriesAction(orderedIds: unknown): Promise<ActionResult> {
  const guard = await guardAction(false);
  if (!guard.ok) return fail(guard.code);
  const parsed = idListSchema.safeParse(orderedIds);
  if (!parsed.success) return fail("generic");
  const db = getDb();
  await db.$transaction(parsed.data.map((id, index) => db.category.update({ where: { id }, data: { order: index } })));
  await audit(guard.ctx, "category.reorder", null, { count: parsed.data.length });
  revalidateContent();
  return ok(undefined);
}
