import { NextResponse, type NextRequest } from "next/server";

import { getClientIp } from "@/lib/security/ip";
import { isSetupAllowed } from "@/lib/setup/gate";
import { checkRate } from "@/lib/security/rate-limit";
import { isInstalled } from "@/lib/setup/state";
import { ensureDataDir, resolveSqliteTarget, testSqliteConnection } from "@/lib/setup/test-connection";
import { dbConfigSchema } from "@/lib/validators/setup";
import { resetDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const rate = await checkRate("setupTest", getClientIp(request.headers));
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

  const body: unknown = await request.json().catch(() => null);
  const useExisting =
    typeof body === "object" &&
    body !== null &&
    (body as { useExisting?: unknown }).useExisting === true;

  let databaseUrl: string | null = null;
  const originalUrl = process.env.DATABASE_URL;
  try {
    if (useExisting) {
      const existing = process.env.DATABASE_URL;
      databaseUrl = existing !== undefined && existing.startsWith("file:") ? existing : null;
    } else {
      const parsed = dbConfigSchema.safeParse(body);
      const target = parsed.success ? resolveSqliteTarget(parsed.data.dataDir) : null;
      if (target === null) {
        return NextResponse.json({ ok: false, code: "generic" }, { status: 400 });
      }
      const dirCheck = await ensureDataDir(target.dir);
      if (!dirCheck.ok) {
        return NextResponse.json({ ok: false, code: dirCheck.code ?? "envWriteFailed" }, { status: 500 });
      }
      // Probe must actually connect to the candidate DB: inject the candidate URL and
      // rebuild the Prisma singleton against it (otherwise the probe would test whatever
      // DB the cached client was born with).
      process.env.DATABASE_URL = target.databaseUrl;
      databaseUrl = target.databaseUrl;
    }
    if (databaseUrl === null) {
      return NextResponse.json({ ok: false, code: "generic" }, { status: 400 });
    }

    await resetDb();
    const result = await testSqliteConnection(databaseUrl);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } finally {
    // Never leak the candidate URL into the process env or the cached client —
    // the install flow re-applies the final URL itself (with its own resetDb).
    process.env.DATABASE_URL = originalUrl;
    await resetDb();
  }
}
