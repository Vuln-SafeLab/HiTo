import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/guard";
import { getTelemetry, getWafRuntimeConfig } from "@/lib/waf/config";

export const dynamic = "force-dynamic";

/** Security center live metrics poll endpoint (ADMIN session; QPS/mode/attack-mode-until). */
export async function GET(): Promise<NextResponse> {
  const user = await getSessionUser();
  if (user === null || user.role !== "ADMIN") {
    return NextResponse.json({ ok: false, code: "unauthorized" }, { status: 401 });
  }
  const [config, telemetry] = await Promise.all([getWafRuntimeConfig(), getTelemetry()]);
  return NextResponse.json({
    ok: true,
    config,
    qps: telemetry?.qps ?? null,
    topRules: telemetry?.topRules ?? [],
  });
}
