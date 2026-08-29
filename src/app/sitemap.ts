import type { MetadataRoute } from "next";
import { getDb } from "@/lib/db";
import { getEnv } from "@/lib/env";

// Depends on DB updatedAt; must be generated per request
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, "");

  let lastModified = new Date();
  try {
    const latest = await getDb().card.findFirst({
      where: { deletedAt: null, status: "PUBLISHED" },
      orderBy: { updatedAt: "desc" },
      select: { updatedAt: true },
    });
    if (latest !== null) lastModified = latest.updatedAt;
  } catch {
    // DB unreachable (e.g. before install): fall back to current time
  }

  return [
    {
      url: base,
      lastModified,
      changeFrequency: "daily",
      priority: 1,
    },
  ];
}
