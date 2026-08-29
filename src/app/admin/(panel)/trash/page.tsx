import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { TrashManager } from "@/components/admin/trash-manager";
import type { TrashCardItem, TrashCategoryItem } from "@/components/admin/types";
import { getDb } from "@/lib/db";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.trash");
  return { title: t("title") };
}

export const dynamic = "force-dynamic";

export default async function TrashPage() {
  const db = getDb();
  const [cardRows, categoryRows] = await Promise.all([
    db.card.findMany({
      where: { deletedAt: { not: null } },
      orderBy: { deletedAt: "desc" },
      select: {
        id: true,
        title: true,
        url: true,
        deletedAt: true,
        category: { select: { name: true } },
      },
    }),
    db.category.findMany({
      where: { deletedAt: { not: null } },
      orderBy: { deletedAt: "desc" },
      select: { id: true, name: true, slug: true, deletedAt: true },
    }),
  ]);

  const cards: TrashCardItem[] = cardRows.map((row) => ({
    id: row.id,
    title: row.title,
    url: row.url,
    categoryName: row.category.name,
    deletedAt: row.deletedAt?.toISOString() ?? "",
  }));

  const categories: TrashCategoryItem[] = categoryRows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    deletedAt: row.deletedAt?.toISOString() ?? "",
  }));

  return <TrashManager cards={cards} categories={categories} />;
}
