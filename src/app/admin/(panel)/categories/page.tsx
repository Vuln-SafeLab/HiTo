import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { CategoriesManager } from "@/components/admin/categories-manager";
import type { AdminCategory } from "@/components/admin/types";
import { getDb } from "@/lib/db";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.nav");
  return { title: t("categories") };
}

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const rows = await getDb().category.findMany({
    where: { deletedAt: null },
    orderBy: { order: "asc" },
    select: {
      id: true,
      slug: true,
      name: true,
      icon: true,
      description: true,
      _count: { select: { cards: { where: { deletedAt: null } } } },
    },
  });

  const categories: AdminCategory[] = rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    icon: row.icon,
    description: row.description,
    cardCount: row._count.cards,
  }));

  return <CategoriesManager categories={categories} />;
}
