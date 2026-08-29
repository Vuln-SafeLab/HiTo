import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { CardsManager } from "@/components/admin/cards-manager";
import type { AdminCard, AdminCategory } from "@/components/admin/types";
import { getDb } from "@/lib/db";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.nav");
  return { title: t("cards") };
}

export const dynamic = "force-dynamic";

export default async function CardsPage() {
  const db = getDb();
  const [cardRows, categoryRows] = await Promise.all([
    db.card.findMany({
      where: { deletedAt: null },
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        title: true,
        url: true,
        description: true,
        favicon: true,
        image: true,
        categoryId: true,
        status: true,
        featured: true,
        clickCount: true,
        linkStatus: true,
        lastCheckedAt: true,
        updatedAt: true,
        tags: { select: { tag: { select: { name: true } } } },
      },
    }),
    db.category.findMany({
      where: { deletedAt: null },
      orderBy: { order: "asc" },
      select: { id: true, slug: true, name: true, icon: true, description: true },
    }),
  ]);

  const cards: AdminCard[] = cardRows.map((row) => ({
    id: row.id,
    title: row.title,
    url: row.url,
    description: row.description,
    favicon: row.favicon,
    image: row.image,
    categoryId: row.categoryId,
    status: row.status as AdminCard["status"],
    featured: row.featured,
    clickCount: row.clickCount,
    linkStatus: row.linkStatus as AdminCard["linkStatus"],
    lastCheckedAt: row.lastCheckedAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
    tags: row.tags.map(({ tag }) => tag.name),
  }));

  const categories: AdminCategory[] = categoryRows.map((row) => ({
    ...row,
    cardCount: 0,
  }));

  return <CardsManager cards={cards} categories={categories} />;
}
