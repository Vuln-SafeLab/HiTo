"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hashPassword } from "@/lib/auth/password";
import { getDb } from "@/lib/db";
import { writeAudit } from "@/lib/security/audit";
import { userFormSchema } from "@/lib/validators/content";
import { fail, guardAction, ok, type ActionContext, type ActionResult } from "@/lib/actions/types";

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

// Must run inside caller's transaction; two concurrent "demote last admin" requests would otherwise both pass
async function wouldOrphanAdmins(tx: Prisma.TransactionClient, targetId: string, nextRole: string, nextActive: boolean): Promise<boolean> {
  if (nextRole === "ADMIN" && nextActive) return false;
  return (await tx.user.count({ where: { id: { not: targetId }, role: "ADMIN", isActive: true } })) === 0;
}

async function audit(ctx: ActionContext, action: string, targetId: string | null, detail?: unknown): Promise<void> {
  await writeAudit({ userId: ctx.user.id, username: ctx.user.username, action, targetType: "user", targetId, detail, ip: ctx.ip, userAgent: ctx.userAgent });
}

export async function createUserAction(input: unknown): Promise<ActionResult> {
  const guard = await guardAction(true);
  if (!guard.ok) return fail(guard.code);
  const parsed = userFormSchema().safeParse(input);
  if (!parsed.success || parsed.data.password === "") return fail("generic");
  try {
    const user = await getDb().user.create({
      data: { username: parsed.data.username, email: parsed.data.email, role: parsed.data.role, isActive: parsed.data.isActive, passwordHash: await hashPassword(parsed.data.password) },
    });
    await audit(guard.ctx, "user.create", user.id, { username: user.username, role: user.role });
  } catch (error) { return fail(isUniqueViolation(error) ? "userExists" : "generic"); }
  revalidatePath("/admin/users");
  return ok(undefined);
}

export async function updateUserAction(id: unknown, input: unknown): Promise<ActionResult> {
  const guard = await guardAction(true);
  if (!guard.ok) return fail(guard.code);
  const idParsed = z.string().cuid().safeParse(id);
  const parsed = userFormSchema().safeParse(input);
  if (!idParsed.success || !parsed.success) return fail("generic");
  const db = getDb();
  const target = await db.user.findUnique({ where: { id: idParsed.data } });
  if (target === null) return fail("generic");
  const passwordChanged = parsed.data.password !== "";
  const passwordHash = passwordChanged ? await hashPassword(parsed.data.password) : undefined;
  try {
    await db.$transaction(async (tx) => {
      if (await wouldOrphanAdmins(tx, target.id, parsed.data.role, parsed.data.isActive)) throw new Error("LAST_ADMIN");
      await tx.user.update({
        where: { id: target.id },
        data: { email: parsed.data.email, role: parsed.data.role, isActive: parsed.data.isActive, ...(passwordHash !== undefined ? { passwordHash } : {}) },
      });
      if (passwordChanged || !parsed.data.isActive) {
        await tx.session.updateMany({ where: { userId: target.id, revokedAt: null }, data: { revokedAt: new Date() } });
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message === "LAST_ADMIN") return fail("lastAdmin");
    return fail(isUniqueViolation(error) ? "userExists" : "generic");
  }
  await audit(guard.ctx, passwordChanged ? "user.reset_password" : "user.update", target.id, { username: target.username, role: parsed.data.role, isActive: parsed.data.isActive });
  revalidatePath("/admin/users");
  return ok(undefined);
}
