import { NextResponse, type NextRequest } from "next/server";
import { verifyInternalRequest } from "@/lib/security/internal-auth";
import { getWafRuntimeConfig } from "@/lib/waf/config";

export const dynamic = "force-dynamic";

/** Kun engine config hot-push (10s single-slot TTL cache on engine; falls back to last good value). */
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!verifyInternalRequest(request.headers, "")) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  try {
    const config = await getWafRuntimeConfig();
    // Engine expects attackModeUntilMs (number); convert from ISO string to epoch ms.
    return NextResponse.json({
      ok: true,
      config: {
        mode: config.mode,
        underAttackQps: config.underAttackQps,
        windowLimit: config.windowLimit,
        rulesDisabled: config.rulesDisabled,
        attackModeUntilMs: config.attackModeUntil !== null ? new Date(config.attackModeUntil).getTime() : 0,
        banReleases: [],
      },
    });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
