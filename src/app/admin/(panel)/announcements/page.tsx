import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AnnouncementsManager } from "@/components/admin/announcements-manager";
import type { AdminAnnouncementItem } from "@/components/admin/types";
import { isWithinWindow } from "@/lib/announcements-shared";
import { requireAdmin } from "@/lib/auth/guard";
import { getDb } from "@/lib/db";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.nav");
  return { title: t("announcements") };
}

export const dynamic = "force-dynamic";

export default async function AnnouncementsPage() {
  await requireAdmin();

  const rows = await getDb().announcement.findMany({
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    take: 200,
  });

  const items: AdminAnnouncementItem[] = rows.map((row) => ({
    id: row.id,
    content: row.content,
    linkUrl: row.linkUrl,
    linkText: row.linkText,
    type: row.type as AdminAnnouncementItem["type"],
    startAt: row.startAt?.toISOString() ?? null,
    endAt: row.endAt?.toISOString() ?? null,
    isActive: row.isActive,
    isDismissible: row.isDismissible,
    priority: row.priority,
    updatedAt: row.updatedAt.toISOString(),
  }));

  // "Currently shown live" = same selection rule as the public site (list is already priority desc).
  const now = Date.now();
  const showing = items.find(
    (item) => item.isActive && isWithinWindow(item.startAt, item.endAt, now)
  );

  return <AnnouncementsManager items={items} showingId={showing?.id ?? null} />;
}
