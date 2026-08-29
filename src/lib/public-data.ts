import { unstable_cache } from "next/cache";
import { getDb } from "@/lib/db";
import type { PublicCard, PublicData } from "@/lib/public-types";

// Single entry point for public-facing data: enforces status=PUBLISHED and not soft-deleted
export const CONTENT_TAG = "public-content";

const getCachedPublicData = unstable_cache(
  async (): Promise<PublicData> => {
    const db = getDb();
    const [categories, cards] = await Promise.all([
      db.category.findMany({
        where: { deletedAt: null },
        orderBy: { order: "asc" },
        select: { id: true, slug: true, name: true, icon: true, description: true },
      }),
      db.card.findMany({
        where: { deletedAt: null, status: "PUBLISHED", category: { deletedAt: null } },
        orderBy: [{ order: "asc" }, { createdAt: "desc" }],
        select: {
          id: true,
          title: true,
          url: true,
          description: true,
          favicon: true,
          image: true,
          categoryId: true,
          featured: true,
          clickCount: true,
          createdAt: true,
          tags: { select: { tag: { select: { name: true } } } },
        },
      }),
    ]);

    const publicCards: PublicCard[] = cards.map((card) => ({
      id: card.id,
      title: card.title,
      url: card.url,
      description: card.description,
      favicon: card.favicon,
      image: card.image,
      categoryId: card.categoryId,
      featured: card.featured,
      clickCount: card.clickCount,
      createdAt: card.createdAt.toISOString(),
      tags: card.tags.map(({ tag }) => tag.name),
    }));

    // Only categories that have at least one published card are exposed
    const usedCategoryIds = new Set(publicCards.map((card) => card.categoryId));
    return {
      categories: categories.filter((category) => usedCategoryIds.has(category.id)),
      cards: publicCards,
    };
  },
  ["public-data"],
  { revalidate: 60, tags: [CONTENT_TAG] }
);

export async function getPublicData(): Promise<PublicData> {
  return await getCachedPublicData();
}
