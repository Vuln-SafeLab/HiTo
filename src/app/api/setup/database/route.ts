import { NextResponse, type NextRequest } from "next/server";
import { resetDb } from "@/lib/db";
import { isAuthConfigured } from "@/lib/env";
import { getClientIp } from "@/lib/security/ip";
import { isSetupAllowed } from "@/lib/setup/gate";
import { checkRate } from "@/lib/security/rate-limit";
import { buildDatabaseUrl, generateSecret, writeEnvVars } from "@/lib/setup/env-writer";
import { ensureDataDir, resolveSqliteTarget, probeSqliteWrite } from "@/lib/setup/test-connection";
import { runMigrateDeploy } from "@/lib/setup/migrate";
import { isInstalled } from "@/lib/setup/state";
import { dbConfigSchema } from "@/lib/validators/setup";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const rate = await checkRate("setupMutate", getClientIp(request.headers));
  if (!rate.ok) {
    return NextResponse.json(
      { ok: false, code: "rateLimited" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }
  // Setup window takeover: only pinned IP / SETUP_ALLOW_IPS / x-setup-token allowed
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

  let databaseUrl: string;
  if (useExisting) {
    const existing = process.env.DATABASE_URL;
    if (existing === undefined || !existing.startsWith("file:")) {
      return NextResponse.json({ ok: false, code: "generic" }, { status: 400 });
    }
    // No pre-migrate write probe here: on a fresh DB the tables don't exist yet and
    // probeSqliteWrite would fail with "does not exist" — the migrate below runs first,
    // and the post-migrate probe at the end of this route validates the same thing.
    await resetDb();
    databaseUrl = existing;
  } else {
    const parsed = dbConfigSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, code: "generic" }, { status: 400 });
    }
    const target = resolveSqliteTarget(parsed.data.dataDir);
    if (target === null) {
      return NextResponse.json({ ok: false, code: "generic" }, { status: 400 });
    }
    const dirCheck = await ensureDataDir(target.dir);
    if (!dirCheck.ok) {
      return NextResponse.json({ ok: false, code: dirCheck.code ?? "envWriteFailed" }, { status: 500 });
    }
    databaseUrl = buildDatabaseUrl({ dataDir: parsed.data.dataDir });
  }

  const varsToWrite: Record<string, string> = {};
  if (!useExisting) {
    varsToWrite.DATABASE_URL = databaseUrl;
  }
  if (!isAuthConfigured()) {
    varsToWrite.AUTH_SECRET = generateSecret(48);
  }
  if (process.env.ANALYTICS_SALT === undefined || process.env.ANALYTICS_SALT === "") {
    varsToWrite.ANALYTICS_SALT = generateSecret(16);
  }
  if (Object.keys(varsToWrite).length > 0) {
    try {
      await writeEnvVars(varsToWrite);
    } catch {
      // Read-only filesystem: surface to user, don't swallow
      return NextResponse.json({ ok: false, code: "envWriteFailed" }, { status: 500 });
    }
  }

  // Sync runtime env with freshly written .env before migrating
  if (varsToWrite.DATABASE_URL !== undefined) {
    process.env.DATABASE_URL = varsToWrite.DATABASE_URL;
  }
  await resetDb();

  // Migrate first (create tables), then R/W probe; order matters
  const migrate = await runMigrateDeploy(databaseUrl);
  if (!migrate.ok) {
    return NextResponse.json(
      { ok: false, code: "dbUnknown", detail: migrate.message },
      { status: 500 }
    );
  }
  const probe = await probeSqliteWrite();
  if (!probe.ok) {
    return NextResponse.json(probe, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
