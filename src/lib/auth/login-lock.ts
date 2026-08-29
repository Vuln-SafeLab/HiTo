import { createHash } from "node:crypto";
import { getDb } from "@/lib/db";

const MAX_FAILURES = 10;
const LOCK_MS = 15 * 60 * 1000;

function lockKey(identifier: string): string {
  const normalized = identifier.trim().toLowerCase();
  return createHash("sha256").update(normalized).digest("hex");
}

function keysOf(identifiers: string[]): string[] {
  return [...new Set(identifiers.map(lockKey))];
}

export async function isLoginLocked(identifiers: string[]): Promise<boolean> {
  const hashes = keysOf(identifiers);
  if (hashes.length === 0) return false;
  try {
    const row = await getDb().loginLockout.findFirst({
      where: { identifierHash: { in: hashes }, lockedUntil: { gt: new Date() } },
      select: { identifierHash: true },
    });
    return row !== null;
  } catch {
    // Fail-open: lockout is hardening, not a login availability dependency
    return false;
  }
}

export async function recordLoginFailure(identifiers: string[]): Promise<void> {
  const hashes = keysOf(identifiers);
  const db = getDb();
  try {
    for (const hash of hashes) {
      await db.$transaction(async (tx) => {
        // SQLite single-writer + interactive tx => MySQL-style FOR UPDATE row-lock
        const rows = await tx.$queryRaw<Array<{ fails: number; lockedUntil: Date | null }>>`
          SELECT fails, lockedUntil FROM login_lockouts
          WHERE identifierHash = ${hash}
        `;
        const current = rows[0];
        let nextFails: number;
        let nextUntil: Date | null;
        const now = new Date();
        if (
          current !== undefined &&
          current.lockedUntil !== null &&
          current.lockedUntil > now
        ) {
          nextFails = current.fails;
          nextUntil = current.lockedUntil;
        } else {
          nextFails = (current?.fails ?? 0) + 1;
          nextUntil = nextFails >= MAX_FAILURES ? new Date(Date.now() + LOCK_MS) : null;
        }
        await tx.$executeRaw`
          INSERT INTO login_lockouts ("identifierHash", "fails", "lockedUntil", "updatedAt")
          VALUES (${hash}, ${nextFails}, ${nextUntil}, CURRENT_TIMESTAMP)
          ON CONFLICT("identifierHash") DO UPDATE SET
            "fails" = ${nextFails},
            "lockedUntil" = ${nextUntil},
            "updatedAt" = CURRENT_TIMESTAMP
        `;
      });
    }
    if (Math.random() < 0.005) {
      await db.loginLockout.deleteMany({ where: { lockedUntil: { lt: new Date() } } }).catch(() => undefined);
    }
  } catch {
    // Drop the increment on write failure: better to miss one than break login
  }
}

export async function clearLoginLock(identifiers: string[]): Promise<void> {
  try {
    await getDb().loginLockout.deleteMany({ where: { identifierHash: { in: keysOf(identifiers) } } });
  } catch {
    // Missing row / transient DB error: a successful login already ends the attack window
  }
}
