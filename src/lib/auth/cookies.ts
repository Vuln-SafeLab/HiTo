import { cookies } from "next/headers";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/auth/constants";
import { getEnv } from "@/lib/env";

function baseOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    // Browsers drop secure cookies on plain-http dev hosts
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}

export async function setAuthCookies(accessToken: string, refreshToken: string): Promise<void> {
  const env = getEnv();
  const store = await cookies();
  store.set(ACCESS_COOKIE, accessToken, { ...baseOptions(), maxAge: env.AUTH_ACCESS_TTL });
  store.set(REFRESH_COOKIE, refreshToken, {
    ...baseOptions(),
    // Strict tightens CSRF window: cross-site POSTs won't carry it; trade-off is users arriving from external links after access-token expiry get redirected to login
    sameSite: "strict" as const,
    maxAge: env.AUTH_REFRESH_TTL,
  });
}

export async function clearAuthCookies(): Promise<void> {
  const store = await cookies();
  store.set(ACCESS_COOKIE, "", { ...baseOptions(), maxAge: 0 });
  store.set(REFRESH_COOKIE, "", { ...baseOptions(), sameSite: "strict" as const, maxAge: 0 });
}
