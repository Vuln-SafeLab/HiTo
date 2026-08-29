import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { analyticsSalt, getClientIdentifier, hashIp } from "@/lib/security/ip";
import { isSameOrigin } from "@/lib/security/origin";
import { checkRate } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

const clickSchema = z.object({
  cardId: z.string().cuid(),
});

const EVENT_RETENTION_DAYS = 30;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const clientKey = await getClientIdentifier(request.headers);
  const rate = await checkRate("click", clientKey);
  if (!rate.ok) {
    return new NextResponse(null, {
      status: 429,
      headers: { "Retry-After": String(rate.retryAfterSeconds) },
    });
  }
  if (!isSameOrigin(request, "POST")) {
    return new NextResponse(null, { status: 403 });
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = clickSchema.safeParse(body);
  // Invalid and non-existent IDs both return 204: not a card-existence probe.
  if (!parsed.success) {
    return new NextResponse(null, { status: 204 });
  }

  try {
    const db = getDb();
    const cardId = parsed.data.cardId;
    const updated = await db.$executeRaw`
      UPDATE cards
      SET clickCount = clickCount + 1
      WHERE id = ${cardId} AND status = 'PUBLISHED' AND deletedAt IS NULL
    `;
    if (updated === 1) {
      const salt = analyticsSalt();
      await db.$executeRaw`
        INSERT INTO click_events ("cardId", "ipHash", "createdAt")
        SELECT ${cardId}, ${salt === null ? null : hashIp(clientKey, salt)}, CURRENT_TIMESTAMP
        FROM cards
        WHERE id = ${cardId} AND status = 'PUBLISHED' AND deletedAt IS NULL
      `;
      if (Math.random() < 0.005) {
        await db.$executeRaw`
          DELETE FROM click_events
          WHERE createdAt < datetime('now', ${`-${EVENT_RETENTION_DAYS} days`})
        `.catch(() => undefined);
      }
    }
  } catch (error) {
    // Track failure is silent: never break user navigation on analytics
    console.error(
      "[click] track failed:",
      error instanceof Error ? error.message.slice(0, 160) : error
    );
  }
  return new NextResponse(null, { status: 204 });
}
