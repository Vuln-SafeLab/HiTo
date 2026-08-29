"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { getDb } from "@/lib/db";
import { writeAudit } from "@/lib/security/audit";
import { APPEARANCE_KEY, APPEARANCE_TAG } from "@/lib/appearance";
import { appearanceFormSchema } from "@/lib/validators/content";
import { fail, guardAction, ok, type ActionResult } from "@/lib/actions/types";

export async function updateAppearanceAction(input: unknown): Promise<ActionResult> {
  const guard = await guardAction(true);
  if (!guard.ok) return fail(guard.code);
  const parsed = appearanceFormSchema().safeParse(input);
  if (!parsed.success) return fail("generic");
  const value = JSON.stringify(parsed.data);
  await getDb().systemConfig.upsert({
    where: { key: APPEARANCE_KEY },
    update: { value },
    create: { key: APPEARANCE_KEY, value },
  });
  await writeAudit({
    userId: guard.ctx.user.id,
    username: guard.ctx.user.username,
    action: "appearance.update",
    targetType: "settings",
    detail: parsed.data,
    ip: guard.ctx.ip,
    userAgent: guard.ctx.userAgent,
  });
  revalidateTag(APPEARANCE_TAG);
  revalidateTag("settings");
  revalidatePath("/", "layout");
  return ok(undefined);
}
