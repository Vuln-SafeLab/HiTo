// Domain-separated key: HMAC-SHA256(AUTH_SECRET, "kun-internal:v1") -> hex; edge runtime, no node:*.
const INTERNAL_ORIGIN = process.env.INTERNAL_ORIGIN ?? "http://127.0.0.1:3000";

let cachedKey: CryptoKey | null = null;

async function getHmacKey(): Promise<CryptoKey | null> {
  if (cachedKey !== null) return cachedKey;
  const secret = process.env.AUTH_SECRET ?? "";
  if (secret === "") return null;
  try {
    const k1 = await crypto.subtle.importKey(
      "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
    );
    const step1 = await crypto.subtle.sign("HMAC", k1, new TextEncoder().encode("kun-internal:v1"));
    const hex1 = Array.from(new Uint8Array(step1)).map((b) => b.toString(16).padStart(2, "0")).join("");
    cachedKey = await crypto.subtle.importKey(
      "raw", new TextEncoder().encode(hex1), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
    );
    return cachedKey;
  } catch {
    return null;
  }
}

async function hmacHex(key: CryptoKey, message: string): Promise<string> {
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function buildInternalRequest(
  pathWithQuery: string,
  body: string
): Promise<{ url: string; init: RequestInit } | null> {
  const key = await getHmacKey();
  if (key === null) return null;
  const ts = String(Date.now());
  const sig = await hmacHex(key, `${ts}.${body}`);
  return {
    url: `${INTERNAL_ORIGIN}${pathWithQuery}`,
    init: {
      method: body === "" ? "GET" : "POST",
      headers: {
        "content-type": "application/json",
        "x-kun-ts": ts,
        "x-kun-signature": sig,
      },
      body: body === "" ? undefined : body,
    },
  };
}

export async function isInternalSignedRequest(request: {
  nextUrl: { pathname: string };
  headers: Headers;
  text?: () => Promise<string>;
  clone?: () => { text: () => Promise<string> };
}): Promise<boolean> {
  const ts = request.headers.get("x-kun-ts");
  const sig = request.headers.get("x-kun-signature");
  if (ts === null || sig === null) return false;
  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum) || Math.abs(Date.now() - tsNum) > 120_000) return false;
  const key = await getHmacKey();
  if (key === null) return false;
  let body = "";
  try {
    const raw = request as unknown as { text?: () => Promise<string>; clone?: () => unknown };
    if (typeof raw.text === "function") {
      body = await (raw.clone?.() as unknown as { text: () => Promise<string> })?.text?.() ?? await raw.text();
    } else if (typeof raw.clone === "function") {
      const cloned = raw.clone() as { text: () => Promise<string> };
      body = await cloned.text();
    }
  } catch {
    body = "";
  }
  // Verify against body when present, else empty string; fall back to pathname for legacy.
  const candidates = body !== "" ? [`${ts}.${body}`, `${ts}.${request.nextUrl.pathname}`] : [`${ts}.`, `${ts}.${request.nextUrl.pathname}`];
  for (const msg of candidates) {
    const expected = await hmacHex(key, msg);
    if (expected.length === sig.length) {
      let diff = 0;
      for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
      if (diff === 0) return true;
    }
  }
  return false;
}
