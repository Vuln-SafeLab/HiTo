import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { runSeed } from "@/lib/seed-data";
import { writeAudit } from "@/lib/security/audit";
import { getClientIp, getClientIdentifier } from "@/lib/security/ip";
import { isSetupAllowed } from "@/lib/setup/gate";
import { isSameOrigin } from "@/lib/security/origin";
import { checkRate } from "@/lib/security/rate-limit";
import { hasAdminUser, isInstalled, markInstalled } from "@/lib/setup/state";
import { finishSchema } from "@/lib/validators/setup";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const ip = getClientIp(request.headers);
  const clientKey = await getClientIdentifier(request.headers);
  const rate = await checkRate("setupMutate", ip);
  if (!isSameOrigin(request, "POST")) {
    return NextResponse.json({ ok: false, code: "forbidden" }, { status: 403 });
  }
  if (!rate.ok) {
    return NextResponse.json(
      { ok: false, code: "rateLimited" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }
  // Setup window takeover protection.
  if (!(await isSetupAllowed(request.headers))) {
    return NextResponse.json({ ok: false, code: "setupLocked" }, { status: 403 });
  }

  if (await isInstalled()) {
    return NextResponse.json({ ok: false, code: "alreadyInstalled" }, { status: 403 });
  }
  // No admin user -> markInstalled would lock the operator out. Hard order invariant.
  if (!(await hasAdminUser())) {
    return NextResponse.json({ ok: false, code: "generic" }, { status: 400 });
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = finishSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, code: "generic" }, { status: 400 });
  }

  const db = getDb();
  if (parsed.data.seed) {
    await runSeed(db);
  }
  await markInstalled();

  await writeAudit({
    username: "system",
    action: "setup.completed",
    targetType: "system",
    detail: { seeded: parsed.data.seed },
    ip: clientKey,
    userAgent: request.headers.get("user-agent") ?? "",
  });

  return NextResponse.json({ ok: true });
}
