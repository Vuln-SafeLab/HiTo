import type { NextRequest } from "next/server";
import { getEnv } from "@/lib/env";

// Cross-site write from a browser always carries Origin; missing Origin on a non-GET method is also
// a CSRF risk (SameSite=Strict stops cross-site POSTs but a misconfigured client or native fetch
// without Origin must be rejected for state-changing endpoints). Pass the expected method to flip
// the policy. Curl/native clients should send Origin explicitly.
export function isSameOrigin(request: NextRequest, method: string = "GET"): boolean {
  const origin = request.headers.get("origin");
  // GET/HEAD are safe methods: missing Origin is acceptable (browsers may omit it for same-origin navigations).
  if (origin === null || origin.trim() === "") {
    return method === "GET" || method === "HEAD";
  }

  let originUrl: URL;
  try {
    originUrl = new URL(origin);
  } catch {
    return false;
  }

  // Proxy-aware: behind nginx the raw Host header can carry the upstream address
  // (127.0.0.1:3000) while the public identity rides in x-forwarded-host — set by
  // the proxy, or re-anchored by middleware from NEXT_PUBLIC_APP_URL.
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ?? "";
  const host = forwardedHost !== "" ? forwardedHost : (request.headers.get("host")?.trim() ?? "");
  if (host !== "") {
    if (originUrl.host === host) return true;
    const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "http";
    if (originUrl.origin === `${proto}://${host}`) return true;
  }

  try {
    if (originUrl.origin === new URL(getEnv().NEXT_PUBLIC_APP_URL).origin) return true;
  } catch {
    // Malformed NEXT_PUBLIC_APP_URL is left to env validation to surface
  }

  return false;
}
