import { NextResponse, type NextRequest } from "next/server";
import type { Role } from "@/lib/app-enums";
import { REFRESH_COOKIE } from "@/lib/auth/constants";
import { clearAuthCookies, setAuthCookies } from "@/lib/auth/cookies";
import { signAccessToken } from "@/lib/auth/jwt";
import { findValidSessionByToken, rotateSession } from "@/lib/auth/session";
import { getClientIp, getClientIdentifier } from "@/lib/security/ip";
import { isSameOrigin } from "@/lib/security/origin";
import { isIpBanned } from "@/lib/security/ip-ban";
import { checkRate } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const ip = getClientIp(request.headers);
  const clientKey = await getClientIdentifier(request.headers);
  const rate = await checkRate("refresh", clientKey);
  if (!rate.ok) {
    return NextResponse.json(
      { ok: false, code: "rateLimited" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }
  if (await isIpBanned(ip)) {
    return NextResponse.json({ ok: false, code: "forbidden" }, { status: 403 });
  }
  if (!isSameOrigin(request, "POST")) {
    return NextResponse.json({ ok: false, code: "forbidden" }, { status: 403 });
  }

  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  if (refreshToken === undefined || refreshToken === "") {
    return NextResponse.json({ ok: false, code: "unauthorized" }, { status: 401 });
  }

  const session = await findValidSessionByToken(refreshToken).catch(() => null);
  if (session === null || !session.user.isActive) {
    // Clear cookies on invalid refresh; client will land on the login page on next navigation.
    await clearAuthCookies();
    return NextResponse.json({ ok: false, code: "unauthorized" }, { status: 401 });
  }

  // Token rotation: stolen old refresh token cannot be replayed since its hash no longer matches.
  const nextRefreshToken = await rotateSession(session.id);
  const accessToken = await signAccessToken({
    sub: session.userId,
    sid: session.id,
    role: session.user.role as Role,
  });
  await setAuthCookies(accessToken, nextRefreshToken);

  return NextResponse.json({ ok: true });
}
