import { jwtVerify, SignJWT } from "jose";
import type { Role } from "@/lib/app-enums";
import { getEnv } from "@/lib/env";

export interface AccessTokenPayload {
  sub: string;
  sid: string;
  role: Role;
}

function secretKey(): Uint8Array {
  const env = getEnv();
  if (env.AUTH_SECRET === undefined) {
    throw new Error("AUTH_SECRET is not configured");
  }
  return new TextEncoder().encode(env.AUTH_SECRET);
}

export async function signAccessToken(payload: AccessTokenPayload): Promise<string> {
  const env = getEnv();
  return await new SignJWT({ sid: payload.sid, role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + env.AUTH_ACCESS_TTL)
    .sign(secretKey());
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    const { sub } = payload;
    const sid = payload.sid;
    const role = payload.role;
    if (
      typeof sub !== "string" ||
      typeof sid !== "string" ||
      (role !== "ADMIN" && role !== "EDITOR")
    ) {
      return null;
    }
    return { sub, sid, role };
  } catch {
    // Expired, tampered, or wrong key — treat all as no token, never leak the specific reason
    return null;
  }
}
