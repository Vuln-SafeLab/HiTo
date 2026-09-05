import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { writeAudit } from "@/lib/security/audit";
import { getClientIp, getClientIdentifier } from "@/lib/security/ip";
import { isSetupAllowed } from "@/lib/setup/gate";
import { isSameOrigin } from "@/lib/security/origin";
import { checkRate } from "@/lib/security/rate-limit";
import { isInstalled, isMigrated } from "@/lib/setup/state";
import { adminFormSchema } from "@/lib/validators/setup";

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
  // Setup window takeover protection: only the pinned operator can create the first admin.
  if (!(await isSetupAllowed(request.headers))) {
    return NextResponse.json({ ok: false, code: "setupLocked" }, { status: 403 });
  }

  if (await isInstalled()) {
    return NextResponse.json({ ok: false, code: "alreadyInstalled" }, { status: 403 });
  }
  if (!(await isMigrated())) {
    return NextResponse.json({ ok: false, code: "generic" }, { status: 400 });
  }

  const db = getDb();
  // First-admin endpoint: if any user already exists, reject outright to block re-registration during install.
  const userCount = await db.user.count();
  if (userCount > 0) {
    return NextResponse.json({ ok: false, code: "alreadyInstalled" }, { status: 403 });
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = adminFormSchema().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, code: "generic" }, { status: 400 });
  }

  const passwordHash = await hashPassword(parsed.data.password);
  let user;
  try {
    user = await db.user.create({
      data: {
        username: parsed.data.username,
        email: parsed.data.email,
        passwordHash,
        role: "ADMIN",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        code: "generic",
        detail: `admin create failed: ${error instanceof Error ? error.message.slice(0, 300) : "unknown"}`,
      },
      { status: 500 }
    );
  }

  await writeAudit({
    userId: user.id,
    username: user.username,
    action: "setup.admin_created",
    targetType: "user",
    targetId: user.id,
    ip: clientKey,
    userAgent: request.headers.get("user-agent") ?? "",
  });

  return NextResponse.json({ ok: true });
}
