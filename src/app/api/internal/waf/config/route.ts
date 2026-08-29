import { NextResponse, type NextRequest } from "next/server";
import { verifyInternalRequest } from "@/lib/security/internal-auth";
import { getWafRuntimeConfig } from "@/lib/waf/config";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Kun engine config hot-push (10s single-slot TTL cache on engine; falls back to last good value). */
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!verifyInternalRequest(request.headers, "")) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  try {
    const config = await getWafRuntimeConfig();

    // Consume pending ban-release orders written by releaseKunBansAction.
    // Each row is delivered to the engine exactly once, then deleted — no accumulation.
    const db = getDb();
    const releaseRows = await db.systemConfig.findMany({
      where: { key: { startsWith: "waf.banRelease." } },
    });
    const banReleases: Array<{ ipKey: string; seq: number }> = [];
    for (const row of releaseRows) {
      try {
        const parsed = JSON.parse(row.value) as { ipKey?: unknown; seq?: unknown };
        if (typeof parsed.ipKey === "string" && typeof parsed.seq === "number") {
          banReleases.push({ ipKey: parsed.ipKey, seq: parsed.seq });
        }
      } catch {
        // malformed entry: still delete it so the queue drains
      }
    }
    if (releaseRows.length > 0) {
      await db.systemConfig.deleteMany({
        where: { key: { in: releaseRows.map((r) => r.key) } },
      });
    }

    // Engine expects attackModeUntilMs (number); convert from ISO string to epoch ms.
    return NextResponse.json({
      ok: true,
      config: {
        // Omit mode when the DB has no waf.mode row: the engine then keeps its
        // SECURITY_ENGINE_MODE (env) value instead of silently downgrading to the default.
        ...(config.modeConfigured ? { mode: config.mode } : {}),
        underAttackQps: config.underAttackQps,
        windowLimit: config.windowLimit,
        rulesDisabled: config.rulesDisabled,
        attackModeUntilMs: config.attackModeUntil !== null ? new Date(config.attackModeUntil).getTime() : 0,
        banReleases,
      },
    });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
