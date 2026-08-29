"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { writeAudit } from "@/lib/security/audit";
import { SEO_KEYS, SETTINGS_KEYS, SETTINGS_TAG } from "@/lib/settings";
import { isValidSocial, SOCIAL_PLATFORM_IDS, type SocialLink } from "@/lib/socials";
import { seoSettingsFormSchema, settingsFormSchema } from "@/lib/validators/content";
import { fail, guardAction, ok, type ActionContext, type ActionResult } from "@/lib/actions/types";

async function audit(ctx: ActionContext, action: string, detail?: unknown): Promise<void> {
  await writeAudit({ userId: ctx.user.id, username: ctx.user.username, action, targetType: "settings", detail, ip: ctx.ip, userAgent: ctx.userAgent });
}

async function upsertMany(db: ReturnType<typeof getDb>, entries: Array<[string, string]>): Promise<void> {
  await db.$transaction(entries.map(([key, value]) => db.systemConfig.upsert({ where: { key }, update: { value }, create: { key, value } })));
}

export async function updateSettingsAction(input: unknown): Promise<ActionResult> {
  const guard = await guardAction(true);
  if (!guard.ok) return fail(guard.code);
  const parsed = settingsFormSchema().safeParse(input);
  if (!parsed.success) return fail("generic");
  await upsertMany(getDb(), [
    [SETTINGS_KEYS.siteName, parsed.data.siteName],
    [SETTINGS_KEYS.logo, parsed.data.logo],
    [SETTINGS_KEYS.maintenance, String(parsed.data.maintenance)],
  ]);
  await audit(guard.ctx, "settings.update", { maintenance: parsed.data.maintenance, siteName: parsed.data.siteName });
  revalidateTag("settings"); revalidatePath("/"); revalidatePath("/admin/settings");
  return ok(undefined);
}

export async function updateSeoSettingsAction(input: unknown): Promise<ActionResult> {
  const guard = await guardAction(true);
  if (!guard.ok) return fail(guard.code);
  const parsed = seoSettingsFormSchema().safeParse(input);
  if (!parsed.success) return fail("generic");
  const d = parsed.data;
  await upsertMany(getDb(), [
    [SETTINGS_KEYS.seoTitle, d.seoTitle], [SETTINGS_KEYS.seoDescription, d.seoDescription],
    [SEO_KEYS.titleTemplate, d.titleTemplate], [SEO_KEYS.keywords, d.keywords], [SEO_KEYS.ogImage, d.ogImage],
    [SEO_KEYS.twitterCard, d.twitterCard], [SEO_KEYS.robotsTxt, d.robotsTxt], [SEO_KEYS.noindex, String(d.noindex)],
    [SEO_KEYS.verifyGoogle, d.verifyGoogle], [SEO_KEYS.verifyBing, d.verifyBing], [SEO_KEYS.verifyBaidu, d.verifyBaidu],
  ]);
  await audit(guard.ctx, "settings.seo_update", { noindex: d.noindex });
  revalidateTag(SETTINGS_TAG); revalidatePath("/"); revalidatePath("/robots.txt"); revalidatePath("/admin/settings");
  return ok(undefined);
}

const socialsSchema = z.array(z.object({ platform: z.enum(SOCIAL_PLATFORM_IDS as [string, ...string[]]), url: z.string().max(2048) })).max(20);

export async function updateSocialsAction(input: unknown): Promise<ActionResult> {
  const guard = await guardAction(true);
  if (!guard.ok) return fail(guard.code);
  const parsed = socialsSchema.safeParse(input);
  if (!parsed.success) return fail("generic");
  const cleaned: SocialLink[] = parsed.data.filter((link) => isValidSocial(link));
  const value = JSON.stringify(cleaned);
  await getDb().systemConfig.upsert({ where: { key: SETTINGS_KEYS.socials }, update: { value }, create: { key: SETTINGS_KEYS.socials, value } });
  await audit(guard.ctx, "settings.socials_update", { count: cleaned.length });
  revalidatePath("/"); revalidatePath("/admin/settings");
  return ok(undefined);
}
