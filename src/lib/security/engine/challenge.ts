import { SignJWT, jwtVerify } from "jose";

const SEED_COOKIE = "hito_kun_seed";
const NONCE_COOKIE = "hito_kun_nonce";
const TOKEN_COOKIE = "hito_kun_t";
const ISSUER = "hito-kun/1.0";

export interface ChallengeCookies {
  seed?: string;
  nonce?: string;
  token?: string;
}

export function readChallengeCookies(request: {
  cookies: { get(name: string): { value: string } | undefined };
}): ChallengeCookies {
  return {
    seed: request.cookies.get(SEED_COOKIE)?.value,
    nonce: request.cookies.get(NONCE_COOKIE)?.value,
    token: request.cookies.get(TOKEN_COOKIE)?.value,
  };
}

function secretKey(): Uint8Array {
  return new TextEncoder().encode(process.env.AUTH_SECRET ?? "");
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function newSeed(): Promise<string> {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifyPow(seed: string, nonce: string, prefix: string): Promise<boolean> {
  if (!/^[0-9a-f]{32}$/.test(seed) || !/^[0-9a-f]{1,24}$/.test(nonce)) return false;
  const hex = await sha256Hex(seed + nonce);
  return hex.startsWith(prefix);
}

export async function issueToken(seed: string, ttlSeconds: number): Promise<string> {
  const seedHash = await sha256Hex(seed);
  return await new SignJWT({ s: seedHash.slice(0, 16) })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + ttlSeconds)
    .sign(secretKey());
}

export async function verifyToken(
  token: string,
  currentSeed: string | undefined,
  ttlSeconds: number
): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), { issuer: ISSUER });
    if (typeof payload.s !== "string") return false;
    if (currentSeed !== undefined) {
      const expect = (await sha256Hex(currentSeed)).slice(0, 16);
      if (payload.s !== expect) return false;
    }
    void ttlSeconds;
    return true;
  } catch {
    return false;
  }
}

export const CHALLENGE_COOKIE_NAMES = {
  seed: SEED_COOKIE,
  nonce: NONCE_COOKIE,
  token: TOKEN_COOKIE,
};
