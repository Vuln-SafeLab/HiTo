import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AdVerificationsManager } from "@/components/admin/ad-verifications-manager";
import type { AdminAdVerificationItem } from "@/components/admin/types";
import { requireAdmin } from "@/lib/auth/guard";
import { getDb } from "@/lib/db";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.nav");
  return { title: t("adVerify") };
}

export const dynamic = "force-dynamic";

export default async function AdVerificationsPage() {
  await requireAdmin();

  const rows = await getDb().adVerification.findMany({
    orderBy: [{ createdAt: "desc" }],
    take: 200,
  });

  const items: AdminAdVerificationItem[] = rows.map((row) => ({
    id: row.id,
    provider: row.provider,
    metaName: row.metaName,
    metaContent: row.metaContent,
    fileName: row.fileName,
    fileContent: row.fileContent,
    dnsType: row.dnsType,
    dnsHost: row.dnsHost,
    dnsValue: row.dnsValue,
    dnsNote: row.dnsNote,
    isActive: row.isActive,
    updatedAt: row.updatedAt.toISOString(),
  }));

  return <AdVerificationsManager items={items} />;
}
