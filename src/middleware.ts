import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/auth/constants";
import { buildCsp, generateNonce } from "@/lib/security/headers";
import { applyPassIssue, inspectRequest, kunResponse } from "@/lib/security/engine/engine";

// installed is one-way (true never reverts); cache only true
let installedLatch = false;

// Loopback self-check: server behind reverse proxy may fail to reach its own public origin
const INTERNAL_ORIGIN = process.env.INTERNAL_ORIGIN ?? "http://127.0.0.1:3000";

async function checkInstalled(): Promise<boolean> {
  if (installedLatch) return true;
  try {
    const response = await fetch(`${INTERNAL_ORIGIN}/api/setup/status`, {
      cache: "no-store",
      // self-check must never wedge the middleware (fresh DB / slow disk)
      signal: AbortSignal.timeout(2500),
    });
    if (!response.ok) return false;
    const data: unknown = await response.json();
    const installed =
      typeof data === "object" &&
      data !== null &&
      (data as { installed?: unknown }).installed === true;
    if (installed) installedLatch = true;
    return installed;
  } catch {
    return false;
  }
}

function applySecurityHeaders(response: NextResponse, csp: string | null): NextResponse {
  if (csp !== null) {
    response.headers.set("Content-Security-Policy", csp);
    response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
  }
  return response;
}

// Redirect base must survive reverse proxies: Next self-hosted builds request.url from
// the Host header, and nginx defaults proxy_set_header Host to the upstream address
// (127.0.0.1:3000) — absolute redirects would then send browsers to localhost. Prefer
// the forwarded headers, then the raw Host, then NEXT_PUBLIC_APP_URL, then request.url.
function redirectBase(request: NextRequest): string {
  const fwdHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ?? "";
  const host = fwdHost !== "" ? fwdHost : (request.headers.get("host")?.trim() ?? "");
  if (host !== "") {
    const fwdProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ?? "";
    const proto = fwdProto !== "" ? fwdProto : new URL(request.url).protocol.replace(":", "");
    return `${proto}://${host}`;
  }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl !== undefined && appUrl.trim() !== "") {
    try {
      return new URL(appUrl).origin;
    } catch {
      // malformed value: fall through to request.url
    }
  }
  return request.url;
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  console.log("[mw] enter", request.nextUrl.pathname);
  const kunVerdict = await inspectRequest(request);
  if (kunVerdict.action === "block" || kunVerdict.action === "challenge") {
    return kunResponse(kunVerdict);
  }

  console.log("[mw] verdict", kunVerdict.action, request.nextUrl.pathname);
  const { pathname } = request.nextUrl;

  const isProduction = process.env.NODE_ENV === "production";
  let csp: string | null = null;
  const requestHeaders = new Headers(request.headers);
  if (isProduction) {
    const nonce = generateNonce();
    csp = buildCsp(nonce);
    requestHeaders.set("x-nonce", nonce);
    requestHeaders.set("content-security-policy", csp);
  }

  console.log("[mw] before checkInstalled", request.nextUrl.pathname);
  const installed = await checkInstalled();
  console.log("[mw] after checkInstalled", installed, request.nextUrl.pathname);
  const isSetupPath = pathname === "/setup" || pathname.startsWith("/setup/");

  if (!installed && !isSetupPath) {
    return applySecurityHeaders(
      NextResponse.redirect(new URL("/setup", redirectBase(request)), 302),
      csp
    );
  }
  if (installed && isSetupPath) {
    return applySecurityHeaders(
      NextResponse.redirect(new URL("/", redirectBase(request)), 302),
      csp
    );
  }

  if (pathname.startsWith("/admin")) {
    const hasAuthCookie =
      request.cookies.has(ACCESS_COOKIE) || request.cookies.has(REFRESH_COOKIE);
    const isLoginPage = pathname === "/admin/login";
    if (!hasAuthCookie && !isLoginPage) {
      return applySecurityHeaders(
        NextResponse.redirect(new URL("/admin/login", redirectBase(request)), 302),
        csp
      );
    }
    // hasAuthCookie && isLoginPage is intentionally NOT redirected here.
    // The login page itself (src/app/admin/login/page.tsx:19) validates the
    // session and only then redirects to /admin. Blindly redirecting on
    // cookie existence causes an infinite loop when the cookie is stale
    // (e.g. after AUTH_SECRET rotation): /admin → /admin/login → /admin ...
  }

  const response = applySecurityHeaders(
    NextResponse.next({ request: { headers: requestHeaders } }),
    csp
  );
  applyPassIssue(response, kunVerdict);
  return response;
}

export const config = {
  // Never blanket-allow dotted paths; only explicit static/infra paths excluded.
  // api/internal MUST stay excluded: the edge engine's HMAC self-fetch re-enters the
  // middleware otherwise, and the in-flight config pull deadlocks every gated route.
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|uploads|api/setup|api/health|api/internal|robots\\.txt|sitemap\\.xml).*)",
  ],
};
