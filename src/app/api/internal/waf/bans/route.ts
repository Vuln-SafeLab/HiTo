import { NextResponse, type NextRequest } from "next/server";
import { verifyInternalRequest } from "@/lib/security/internal-auth";
import { saveKunSnapshot } from "@/lib/waf/config";

export const dynamic = "force-dynamic";

/**
 * Kun engine ban snapshot + live telemetry ingest (10s probe interval, fire-and-forget on engine).
 * Node side just overwrite-writes two SystemConfig keys for the security center and unban echoes.
 */
interface BanEntry {
  ipKey: string;
  bannedUntil: number;
  strikes: number;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const raw = await request.text().catch(() => "");
  if (raw === "" || raw.length > 32_000) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (!verifyInternalRequest(request.headers, raw)) {
    return NextResponse.json({ ok: false, code: "unauthorized" }, { status: 401 });
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    const body = parsed as { bans?: unknown; telemetry?: unknown };
    const bans = Array.isArray(body.bans)
      ? (body.bans as BanEntry[])
          .filter((b) => typeof b === "object" && b !== null && typeof (b as BanEntry).ipKey === "string")
          .slice(0, 20)
      : [];
    const telemetry =
      typeof body.telemetry === "object" && body.telemetry !== null ? body.telemetry : {};
    await saveKunSnapshot(JSON.stringify(bans), JSON.stringify(telemetry));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(
      "[kun-bans] snapshot failed:",
      error instanceof Error ? error.message.slice(0, 120) : error
    );
    return NextResponse.json({ ok: false }, { status: 200 }); // 200 to prevent engine retry
  }
}
