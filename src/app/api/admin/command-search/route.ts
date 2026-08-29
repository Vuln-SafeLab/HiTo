import { NextResponse, type NextRequest } from "next/server";
import type { CommandSearchResult } from "@/lib/command-registry";
import { getSessionUser } from "@/lib/auth/guard";
import { getDb } from "@/lib/db";
import { checkRate } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

const EMPTY: CommandSearchResult = { cards: [], categories: [], tags: [] };

// Global search for the command palette: matches cards (title/url/description), categories, tags. Max 5 per group.
export async function GET(request: NextRequest): Promise<NextResponse> {
  const user = await getSessionUser();
  if (user === null) {
    return NextResponse.json({ ok: false, code: "unauthorized" }, { status: 401 });
  }
  const rate = await checkRate("search", user.id);
  if (!rate.ok) {
    return NextResponse.json(
      { ok: false, code: "rateLimited" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  const q = request.nextUrl.searchParams.get("q")?.trim().slice(0, 100) ?? "";
  if (q === "") {
    return NextResponse.json({ ok: true, data: EMPTY });
  }

  const db = getDb();
  const [cards, categories, tags] = await Promise.all([
    db.card.findMany({
      where: {
        deletedAt: null,
        OR: [
          { title: { contains: q } },
          { url: { contains: q } },
          { description: { contains: q } },
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { id: true, title: true, url: true },
    }),
    db.category.findMany({
      where: {
        deletedAt: null,
        OR: [{ name: { contains: q } }, { slug: { contains: q } }],
      },
      orderBy: { order: "asc" },
      take: 5,
      select: { id: true, name: true, slug: true },
    }),
    db.tag.findMany({
      where: { name: { contains: q } },
      take: 5,
      select: { id: true, name: true },
    }),
  ]);

  const data: CommandSearchResult = { cards, categories, tags };
  return NextResponse.json({ ok: true, data });
}
