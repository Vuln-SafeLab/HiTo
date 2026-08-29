import { createHmac, timingSafeEqual } from "node:crypto";

export const INTERNAL_TS_WINDOW_MS = 120_000;

export function internalSecret(): string {
  return createHmac("sha256", process.env.AUTH_SECRET ?? "").update("kun-internal:v1").digest("hex");
}

export function signPayload(ts: string, body: string): string {
  return createHmac("sha256", internalSecret()).update(`${ts}.${body}`).digest("hex");
}

// Anti-replay: signatures accepted once within the TS window. Bounded size — only
// legitimately signed (engine-originated) requests ever reach this check.
const seenSigs = new Map<string, number>();
const SEEN_MAX = 4096;

export function verifyInternalRequest(headers: Headers, rawBody: string): boolean {
  const secret = process.env.AUTH_SECRET ?? "";
  // Empty AUTH_SECRET => HMAC key derivable by anyone: fail closed.
  if (secret.trim() === "") return false;
  const ts = headers.get("x-kun-ts") ?? "";
  const sig = headers.get("x-kun-signature") ?? "";
  if (ts === "" || sig === "") return false;
  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum) || Math.abs(Date.now() - tsNum) > INTERNAL_TS_WINDOW_MS) {
    return false;
  }
  const expect = Buffer.from(signPayload(ts, rawBody), "utf8");
  const got = Buffer.from(sig, "utf8");
  if (expect.length !== got.length) return false;
  if (!timingSafeEqual(expect, got)) return false;

  const now = Date.now();
  if (seenSigs.has(sig)) return false; // replay within the TS window
  seenSigs.set(sig, now + INTERNAL_TS_WINDOW_MS);
  if (seenSigs.size > SEEN_MAX) {
    for (const [k, expiry] of seenSigs) {
      if (expiry <= now) seenSigs.delete(k);
    }
    // still oversized (restart storm etc.): drop oldest half
    if (seenSigs.size > SEEN_MAX) {
      const keys = [...seenSigs.keys()].slice(0, Math.floor(SEEN_MAX / 2));
      for (const k of keys) seenSigs.delete(k);
    }
  }
  return true;
}
