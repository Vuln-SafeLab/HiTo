"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { writeAudit } from "@/lib/security/audit";
import { fail, guardAction, ok, type ActionResult } from "@/lib/actions/types";

const MAX_ADS_TXT_BYTES = 256 * 1024;
const MAX_LINE_CHARS = 512;

// Lenient 4-field syntax: <domain>, <pub-id>, <DIRECT|RESELLER>, <cert-id>; # comments and blank lines allowed
function isValidAdsTxt(text: string): boolean {
  if (Buffer.byteLength(text, "utf8") > MAX_ADS_TXT_BYTES) return false;
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;
    if (trimmed.length > MAX_LINE_CHARS) return false;
    const parts = trimmed.split(",").map((p) => p.trim());
    if (parts.length !== 4) return false;
    const domain = parts[0] ?? "";
    if (!/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/.test(domain.toLowerCase())) return false;
    const pubId = parts[1] ?? "";
    if (pubId.length === 0 || pubId.length > 128) return false;
    const kind = parts[2] ?? "";
    if (!/^(DIRECT|RESELLER)$/i.test(kind)) return false;
    const certId = parts[3] ?? "";
    if (!/^[A-Za-z0-9-]+$/.test(certId) || certId.length > 128) return false;
  }
  return true;
}

export async function saveAdsTxtAction(input: unknown): Promise<ActionResult> {
  const guard = await guardAction(true);
  if (!guard.ok) return fail(guard.code);
  const parsed = z.object({ content: z.string().max(MAX_ADS_TXT_BYTES) }).safeParse(input);
  if (!parsed.success) return fail("generic");
  if (!isValidAdsTxt(parsed.data.content)) return fail("invalidAdsTxt");

  await getDb().systemConfig.upsert({
    where: { key: "ads.txt.content" },
    update: { value: parsed.data.content },
    create: { key: "ads.txt.content", value: parsed.data.content },
  });
  await writeAudit({
    userId: guard.ctx.user.id,
    username: guard.ctx.user.username,
    action: "ads.txt.save",
    targetType: "ads",
    detail: { bytes: Buffer.byteLength(parsed.data.content, "utf8") },
    ip: guard.ctx.ip,
    userAgent: guard.ctx.userAgent,
  });
  revalidatePath("/ads.txt");
  revalidatePath("/admin/ads");
  return ok(undefined);
}

export async function getAdsTxtContent(): Promise<string> {
  try {
    const row = await getDb().systemConfig.findUnique({
      where: { key: "ads.txt.content" },
      select: { value: true },
    });
    return row?.value ?? "";
  } catch {
    return "";
  }
}
