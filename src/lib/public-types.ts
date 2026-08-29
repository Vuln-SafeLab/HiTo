// Zero-runtime-dep file so client components can import this without dragging Prisma into the browser bundle
export interface PublicCard {
  id: string;
  title: string;
  url: string;
  description: string | null;
  favicon: string | null;
  image: string | null;
  categoryId: string;
  featured: boolean;
  clickCount: number;
  createdAt: string;
  tags: string[];
}

export interface PublicCategory {
  id: string;
  slug: string;
  name: string;
  icon: string;
  description: string | null;
}

export interface PublicData {
  categories: PublicCategory[];
  cards: PublicCard[];
}
