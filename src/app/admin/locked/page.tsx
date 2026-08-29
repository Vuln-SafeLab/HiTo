import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { LockedClient } from "@/components/admin/locked-client";
import { getAdminLockUntil } from "@/lib/waf/admin-lock";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("waf");
  return { title: t("lockedTitle") };
}

export default async function AdminLockedPage() {
  // If accessed while not locked: redirect to login (avoid bypass).
  const until = await getAdminLockUntil();
  if (until === null) redirect("/admin/login");
  return <LockedClient untilIso={until.toISOString()} />;
}
