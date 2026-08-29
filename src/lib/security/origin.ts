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

  let originHost: string;
  try {
    originHost = new URL(origin).origin;
  } catch {
    return false;
  }

  const host = request.headers.get("host");
  if (host !== null && host.trim() !== "") {
    const proto =
      request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "http";
    if (
      originHost === `${proto}://${host}` ||
      originHost === `https://${host}` ||
      originHost === `http://${host}`
    ) {
      return true;
    }
  }

  try {
    if (originHost === new URL(getEnv().NEXT_PUBLIC_APP_URL).origin) return true;
  } catch {
    // Malformed NEXT_PUBLIC_APP_URL is left to env validation to surface
  }

  return false;
}
