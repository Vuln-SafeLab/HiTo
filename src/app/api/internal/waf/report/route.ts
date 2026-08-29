import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { verifyInternalRequest } from "@/lib/security/internal-auth";
import { getWafRuntimeConfig } from "@/lib/waf/config";

export const dynamic = "force-dynamic";

const MAX_ROWS_PER_POST = 10;

interface IncomingEvent {
  eventId: string;
  ruleId: string;
  action: string;
  ip: string;
  path: string;
  method: string;
  ua: string;
  sample?: string | null;
  count?: number;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const raw = await request.text().catch(() => "");
  if (raw === "" || raw.length > 64_000) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (!verifyInternalRequest(request.headers, raw)) {
    return NextResponse.json({ ok: false, code: "unauthorized" }, { status: 401 });
  }

  let batch: IncomingEvent[];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || !Array.isArray((parsed as { events?: unknown }).events)) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    batch = (parsed as { events: unknown }).events as IncomingEvent[];
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (batch.length === 0 || batch.length > 20) {
    return NextResponse.json({ ok: true, inserted: 0 });
  }

  // Per-batch aggregation: ruleId+ip+10s window -> single row
  const groups = new Map<string, IncomingEvent & { at: Date }>();
  for (const ev of batch.slice(0, 20)) {
    if (
      typeof ev.ruleId !== "string" || typeof ev.action !== "string" ||
      typeof ev.ip !== "string" || typeof ev.path !== "string"
    ) continue;
    const bucket = Math.floor(Date.now() / 10_000);
    const key = `${ev.ruleId}|${ev.ip}|${bucket}`;
    const existing = groups.get(key);
    if (existing !== undefined) {
      existing.count = (existing.count ?? 0) + (typeof ev.count === "number" && ev.count > 0 ? ev.count : 1);
    } else {
      groups.set(key, {
        eventId: typeof ev.eventId === "string" ? ev.eventId.slice(0, 40) : "",
        ruleId: ev.ruleId.slice(0, 32),
        action: ev.action === "log" || ev.action === "block" || ev.action === "challenge" || ev.action === "ban" ? ev.action : "log",
        ip: ev.ip.slice(0, 64),
        path: ev.path.slice(0, 512),
        method: typeof ev.method === "string" ? ev.method.slice(0, 8) : "GET",
        ua: typeof ev.ua === "string" ? ev.ua.slice(0, 256) : "",
        sample: typeof ev.sample === "string" ? ev.sample.slice(0, 512) : undefined,
        count: typeof ev.count === "number" && ev.count > 0 ? ev.count : 1,
        at: new Date(),
      });
    }
  }

  let inserted = 0;
  try {
    const db = getDb();
    const rows = Array.from(groups.values()).slice(0, MAX_ROWS_PER_POST);
    for (const row of rows) {
      await db.wafEvent.create({
        data: {
          eventId: row.eventId,
          ruleId: row.ruleId,
          action: row.action,
          ip: row.ip,
          path: row.path,
          method: row.method,
          ua: row.ua,
          sample: row.sample,
          count: row.count,
        },
      });
      inserted += 1;
    }
  } catch (error) {
    // Flood / lock conflict: silently drop; never retry to avoid backpressure
    console.error(
      "[kun-report] insert failed (dropped):",
      error instanceof Error ? error.message.slice(0, 120) : error
    );
  }

  const config = await getWafRuntimeConfig();
  return NextResponse.json({ ok: true, inserted, config });
}
