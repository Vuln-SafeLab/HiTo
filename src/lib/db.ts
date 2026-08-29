import { PrismaClient } from "@prisma/client";
import { isDatabaseConfigured } from "@/lib/env";

// DATABASE_URL legitimately absent before install completes
export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super("DATABASE_URL is not configured yet");
    this.name = "DatabaseNotConfiguredError";
  }
}

// In dev, Next HMR re-evaluates modules; new PrismaClient per re-eval would each hold a connection pool.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Single-writer SQLite: WAL journal, busy_timeout, synchronous=NORMAL (safe with WAL,
// ~2-3× faster writes than FULL), foreign_keys
async function initSqlitePragmas(db: PrismaClient): Promise<void> {
  try {
    await db.$queryRawUnsafe("PRAGMA journal_mode=WAL");
    await db.$queryRawUnsafe("PRAGMA busy_timeout=5000");
    await db.$queryRawUnsafe("PRAGMA synchronous=NORMAL");
    await db.$queryRawUnsafe("PRAGMA foreign_keys=ON");
  } catch (error) {
    // PRAGMA failure is non-fatal (e.g. DB file not yet writable pre-install)
    console.error(
      "[db] sqlite pragma init failed:",
      error instanceof Error ? error.message.slice(0, 160) : error
    );
  }
}

export function getDb(): PrismaClient {
  if (!isDatabaseConfigured()) {
    throw new DatabaseNotConfiguredError();
  }
  if (!globalForPrisma.prisma) {
    const client = new PrismaClient({
      log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    });
    globalForPrisma.prisma = client;
    void initSqlitePragmas(client);
  }
  return globalForPrisma.prisma;
}

export async function resetDb(): Promise<void> {
  if (globalForPrisma.prisma) {
    await globalForPrisma.prisma.$disconnect();
    globalForPrisma.prisma = undefined;
  }
}
