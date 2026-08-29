import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { DataManager } from "@/components/admin/data-manager";
import { requireUser } from "@/lib/auth/guard";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.nav");
  return { title: t("data") };
}

export const dynamic = "force-dynamic";

export default async function DataPage() {
  await requireUser();
  return <DataManager />;
}
