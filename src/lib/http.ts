import { headers } from "next/headers";

/**
 * Whether cookies should carry the Secure attribute.
 * NODE_ENV alone breaks the documented plain-HTTP quick start (browser drops
 * Secure cookies → login loops). Derive from the actual request protocol:
 * behind TLS termination x-forwarded-proto is "https"; direct HTTPS too.
 */
export async function isSecureRequest(): Promise<boolean> {
  try {
    const headerStore = await headers();
    const proto = headerStore.get("x-forwarded-proto")?.split(",")[0]?.trim();
    if (proto === "https") return true;
    if (proto === "http") return false;
  } catch {
    // headers() unavailable (e.g. outside request scope)
  }
  const publicUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  return publicUrl.startsWith("https://");
}
