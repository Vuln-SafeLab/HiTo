// Domain-separated key: HMAC-SHA256(AUTH_SECRET, "kun-internal:v1") -> hex; shared with engine.
import { createHmac, timingSafeEqual } from "node:crypto";

export const INTERNAL_TS_WINDOW_MS = 120_000;

export function internalSecret(): string {
  return createHmac("sha256", process.env.AUTH_SECRET ?? "").update("kun-internal:v1").digest("hex");
}

export function signPayload(ts: string, body: string): string {
  return createHmac("sha256", internalSecret()).update(`${ts}.${body}`).digest("hex");
}

export function verifyInternalRequest(headers: Headers, rawBody: string): boolean {
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
  return timingSafeEqual(expect, got);
}
