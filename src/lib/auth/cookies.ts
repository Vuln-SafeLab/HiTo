import { cookies } from "next/headers";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/auth/constants";
import { getEnv } from "@/lib/env";
import { isSecureRequest } from "@/lib/http";

function baseOptions(secure: boolean) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    // Secure only when the request is actually HTTPS — a production build served
    // over plain HTTP (documented quick start) must still be able to log in.
    secure,
    path: "/",
  };
}

export async function setAuthCookies(accessToken: string, refreshToken: string): Promise<void> {
  const env = getEnv();
  const secure = await isSecureRequest();
  const store = await cookies();
  store.set(ACCESS_COOKIE, accessToken, { ...baseOptions(secure), maxAge: env.AUTH_ACCESS_TTL });
  store.set(REFRESH_COOKIE, refreshToken, {
    ...baseOptions(secure),
    // Strict tightens CSRF window: cross-site POSTs won't carry it; trade-off is users arriving from external links after access-token expiry get redirected to login
    sameSite: "strict" as const,
    maxAge: env.AUTH_REFRESH_TTL,
  });
}

export async function clearAuthCookies(): Promise<void> {
  const secure = await isSecureRequest();
  const store = await cookies();
  store.set(ACCESS_COOKIE, "", { ...baseOptions(secure), maxAge: 0 });
  store.set(REFRESH_COOKIE, "", { ...baseOptions(secure), sameSite: "strict" as const, maxAge: 0 });
}
