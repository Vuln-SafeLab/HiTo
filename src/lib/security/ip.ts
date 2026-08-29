import { createHash, createHmac, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { getEnv } from "@/lib/env";
import { isSecureRequest } from "@/lib/http";

const CC_COOKIE = "hito_cc";
const CC_TTL_SECONDS = 24 * 3600;

function ccSecret(): string {
  return createHmac("sha256", process.env.AUTH_SECRET ?? "").update("hito-cc:v1").digest("hex");
}

function signCcId(rawId: string): string {
  return createHmac("sha256", ccSecret()).update(rawId).digest("hex").slice(0, 32);
}

function verifyCc(rawId: string, sig: string): boolean {
  const expect = signCcId(rawId);
  if (expect.length !== sig.length) return false;
  // constant-time compare
  let diff = 0;
  for (let i = 0; i < expect.length; i++) diff |= expect.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}

export function normalizeIp(raw: string): string {
  const value = raw.trim();
  return value.toLowerCase().startsWith("::ffff:") ? value.slice("::ffff:".length) : value;
}

/**
 * Returns a stable, per-browser identifier suitable for rate limiting and click dedup.
 * Combines the signed `hito_cc` cookie (per-browser) with the IP (per-network). TRUST_PROXY
 * only controls which header becomes the IP source — the cookie is always set, so attackers
 * cannot bypass rate limits by rotating the XFF rightmost hop from inside their own upstream proxy.
 */
export async function getClientIdentifier(headers: Headers): Promise<string> {
  const store = await cookies();
  const existing = store.get(CC_COOKIE)?.value ?? "";
  let ccId = "";
  if (existing !== "") {
    const dot = existing.indexOf(".");
    if (dot > 0) {
      const id = existing.slice(0, dot);
      const sig = existing.slice(dot + 1);
      if (verifyCc(id, sig)) ccId = id;
    }
  }
  if (ccId === "") {
    ccId = randomBytes(16).toString("hex");
    const sig = signCcId(ccId);
    store.set(CC_COOKIE, `${ccId}.${sig}`, {
      httpOnly: true,
      sameSite: "lax",
      secure: await isSecureRequest(),
      path: "/",
      maxAge: CC_TTL_SECONDS,
    });
  }
  // Anti-evasion: cookie-less clients get a DETERMINISTIC `anon:<ip>` key, never a
  // fresh random id (that would mint a new rate-limit bucket per request and neuter
  // limiting). With TRUST_PROXY=false everyone shares the "direct" bucket — limiting
  // works at the cost of a shared budget, until real IPs are available.
  const ip = resolveIp(headers);
  return existing !== ""
    ? `cc:${ccId}|ip:${ip}`
    : `anon:${ip}`;
}

function resolveIp(headers: Headers): string {
  if (getEnv().TRUST_PROXY === "true") {
    const forwarded = headers.get("x-forwarded-for");
    if (forwarded !== null && forwarded.trim() !== "") {
      const segments = forwarded.split(",").map((s) => s.trim()).filter(Boolean);
      const rightmost = segments[segments.length - 1];
      if (rightmost !== undefined && rightmost !== "") return normalizeIp(rightmost);
    }
    const real = headers.get("x-real-ip");
    if (real !== null && real.trim() !== "") return normalizeIp(real);
    return "127.0.0.1";
  }
  return "direct";
}

/** Backwards-compatible sync wrapper for places that cannot await (middleware/edge). */
export function getClientIp(headers: Headers): string {
  if (getEnv().TRUST_PROXY === "true") {
    const forwarded = headers.get("x-forwarded-for");
    if (forwarded !== null && forwarded.trim() !== "") {
      const segments = forwarded.split(",").map((s) => s.trim()).filter(Boolean);
      const rightmost = segments[segments.length - 1];
      if (rightmost !== undefined && rightmost !== "") return normalizeIp(rightmost);
    }
    const real = headers.get("x-real-ip");
    if (real !== null && real.trim() !== "") return normalizeIp(real);
    return "127.0.0.1";
  }
  const raw = headers.get("cookie") ?? "";
  const match = raw.match(/(?:^|;\s*)hito_cc=([^;]+)/);
  if (match) {
    const cookie = match[1];
    if (cookie !== undefined) {
      const dot = cookie.indexOf(".");
      if (dot > 0) {
        const id = cookie.slice(0, dot);
        const sig = cookie.slice(dot + 1);
        if (verifyCc(id, sig)) return `cc:${id}`;
      }
    }
  }
  return "direct";
}

export function hashIp(ip: string, salt: string): string {
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

export function analyticsSalt(): string | null {
  const direct = process.env.ANALYTICS_SALT;
  if (direct !== undefined && direct.trim() !== "") return direct.trim();
  const secret = process.env.AUTH_SECRET;
  if (secret !== undefined && secret.trim() !== "") {
    return createHmac("sha256", secret).update("navsite:analytics-salt:v1").digest("hex");
  }
  return null;
}
