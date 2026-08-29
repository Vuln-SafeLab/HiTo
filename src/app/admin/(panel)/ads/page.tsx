import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AdsTxtCard } from "@/components/admin/ads-txt-card";
import { AdsManager } from "@/components/admin/ads-manager";
import type { AdminAdItem } from "@/components/admin/types";
import { requireAdmin } from "@/lib/auth/guard";
import { getAdsTxtContent } from "@/lib/actions/ads-txt";
import { getDb } from "@/lib/db";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.nav");
  return { title: t("ads") };
}

export const dynamic = "force-dynamic";

export default async function AdsPage() {
  await requireAdmin();

  const [rows, adsTxt] = await Promise.all([
    getDb().advertisement.findMany({
      orderBy: [{ weight: "desc" }, { createdAt: "desc" }],
      take: 500,
    }),
    getAdsTxtContent(),
  ]);

  const items: AdminAdItem[] = rows.map((row) => ({
    id: row.id,
    provider: row.provider,
    alias: row.alias,
    position: row.position as AdminAdItem["position"],
    type: row.type as AdminAdItem["type"],
    device: row.device as AdminAdItem["device"],
    code: row.code,
    isActive: row.isActive,
    weight: row.weight,
    startAt: row.startAt?.toISOString() ?? null,
    endAt: row.endAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
  }));

  return (
    <div className="flex flex-col gap-6">
      <AdsManager items={items} />
      <AdsTxtCard initial={adsTxt} />
    </div>
  );
}
