import { createHash, randomBytes } from "node:crypto";
import type { Session, User } from "@prisma/client";
import { getDb } from "@/lib/db";
import { getEnv } from "@/lib/env";

// Tokens stored as SHA-256 hashes only — a DB leak does not leak tokens
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function newRefreshToken(): string {
  return randomBytes(48).toString("hex");
}

function refreshExpiry(): Date {
  return new Date(Date.now() + getEnv().AUTH_REFRESH_TTL * 1000);
}

export async function createSession(
  userId: string,
  ip: string,
  userAgent: string
): Promise<{ refreshToken: string; session: Session }> {
  const refreshToken = newRefreshToken();
  const session = await getDb().session.create({
    data: {
      tokenHash: hashToken(refreshToken),
      userId,
      ip,
      userAgent: userAgent.slice(0, 512),
      expiresAt: refreshExpiry(),
    },
  });
  // Probabilistic cleanup of expired/revoked sessions >30 days (~1 in 500 logins)
  if (Math.random() < 0.002) {
    const cutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    await getDb()
      .session.deleteMany({
        where: { OR: [{ expiresAt: { lt: cutoff } }, { revokedAt: { lt: cutoff } }] },
      })
      .catch(() => undefined);
  }
  return { refreshToken, session };
}

export async function findValidSessionByToken(
  refreshToken: string
): Promise<(Session & { user: User }) | null> {
  return await getDb().session.findFirst({
    where: {
      tokenHash: hashToken(refreshToken),
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: { user: true },
  });
}

export async function findValidSessionById(
  sessionId: string
): Promise<(Session & { user: User }) | null> {
  return await getDb().session.findFirst({
    where: { id: sessionId, revokedAt: null, expiresAt: { gt: new Date() } },
    include: { user: true },
  });
}

export async function rotateSession(sessionId: string): Promise<string> {
  const refreshToken = newRefreshToken();
  await getDb().session.update({
    where: { id: sessionId },
    data: {
      tokenHash: hashToken(refreshToken),
      lastUsedAt: new Date(),
      expiresAt: refreshExpiry(),
    },
  });
  return refreshToken;
}

export async function revokeSession(sessionId: string): Promise<void> {
  await getDb().session.updateMany({
    where: { id: sessionId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeOtherSessions(userId: string, keepSessionId: string): Promise<number> {
  const result = await getDb().session.updateMany({
    where: { userId, id: { not: keepSessionId }, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return result.count;
}
