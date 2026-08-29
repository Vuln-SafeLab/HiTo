import { LRUCache } from "lru-cache";

export interface RateRule {
  limit: number;
  windowMs: number;
}

export interface RateResult {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export interface RateLimiter {
  limit(key: string, rule: RateRule): Promise<RateResult>;
}

interface Bucket {
  count: number;
  resetAt: number;
}

class MemoryRateLimiter implements RateLimiter {
  // LRU cap prevents memory blowup from mass fake keys (e.g. forged X-Forwarded-For)
  private readonly buckets = new LRUCache<string, Bucket>({ max: 50_000 });

  async limit(key: string, rule: RateRule): Promise<RateResult> {
    const now = Date.now();
    const bucket = this.buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + rule.windowMs });
      return { ok: true, remaining: rule.limit - 1, retryAfterSeconds: 0 };
    }

    if (bucket.count >= rule.limit) {
      return {
        ok: false,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
      };
    }

    bucket.count += 1;
    return { ok: true, remaining: rule.limit - bucket.count, retryAfterSeconds: 0 };
  }
}

class DatabaseRateLimiter implements RateLimiter {
  async limit(key: string, rule: RateRule): Promise<RateResult> {
    const now = Date.now();
    const windowEnd = new Date(now + rule.windowMs);
    const nowDate = new Date(now);
    try {
      const { getDb } = await import("@/lib/db");
      const db = getDb();
      await db.$executeRaw`
        INSERT INTO rate_limit_buckets ("key", "count", "resetAt")
        VALUES (${key}, 1, ${windowEnd})
        ON CONFLICT("key") DO UPDATE SET
          "count" = CASE WHEN "resetAt" <= ${nowDate} THEN 1 ELSE "count" + 1 END,
          "resetAt" = CASE WHEN "resetAt" <= ${nowDate} THEN ${windowEnd} ELSE "resetAt" END
      `;
      const rows = await db.$queryRaw<Array<{ count: number; resetAt: Date }>>`
        SELECT "count" AS count, "resetAt" AS resetAt
        FROM rate_limit_buckets
        WHERE "key" = ${key}
        LIMIT 1
      `;
      const row = rows[0];
      if (row === undefined) {
        return { ok: true, remaining: rule.limit - 1, retryAfterSeconds: 0 };
      }
      if (Math.random() < 0.002) {
        await db
          .$executeRaw`DELETE FROM rate_limit_buckets WHERE resetAt < datetime('now')`
          .catch(() => undefined);
      }
      const count = Number(row.count);
      if (count > rule.limit) {
        return {
          ok: false,
          remaining: 0,
          retryAfterSeconds: Math.max(1, Math.ceil((row.resetAt.getTime() - now) / 1000)),
        };
      }
      return { ok: true, remaining: Math.max(0, rule.limit - count), retryAfterSeconds: 0 };
    } catch (error) {
      // DB write/read failed: fail-closed in production so a multi-replica deployment
      // does not silently downgrade to per-instance memory (which would let attackers
      // bypass cross-replica rate limits by spreading requests).
      if (process.env.NODE_ENV === "production") {
        throw new Error(
          `[rate-limit] DB write failed: ${error instanceof Error ? error.message.slice(0, 120) : error}`
        );
      }
      return memoryFallback.limit(key, rule);
    }
  }
}

const globalForRateLimit = globalThis as unknown as {
  rateLimiter?: RateLimiter;
  memoryRateLimiter?: MemoryRateLimiter;
};

const memoryFallback =
  globalForRateLimit.memoryRateLimiter ??
  (globalForRateLimit.memoryRateLimiter = new MemoryRateLimiter());

function resolveDriver(): "memory" | "db" {
  const driver = process.env.RATE_LIMIT_DRIVER === "db" ? "db" : "memory";
  if (driver === "memory" && process.env.NODE_ENV === "production") {
    throw new Error(
      "[rate-limit] RATE_LIMIT_DRIVER=memory in production — " +
        "single-instance LRU bypasses cross-replica limits; set RATE_LIMIT_DRIVER=db"
    );
  }
  return driver;
}

export const rateLimiter: RateLimiter =
  globalForRateLimit.rateLimiter ??
  (globalForRateLimit.rateLimiter =
    resolveDriver() === "db"
      ? new DatabaseRateLimiter()
      : new MemoryRateLimiter());

export const rateRules = {
  setupTest: { limit: 10, windowMs: 60_000 },
  setupMutate: { limit: 5, windowMs: 60_000 },
  login: { limit: 5, windowMs: 60_000 },
  refresh: { limit: 20, windowMs: 60_000 },
  adminWrite: { limit: 60, windowMs: 60_000 },
  search: { limit: 60, windowMs: 60_000 },
  upload: { limit: 20, windowMs: 60_000 },
  click: { limit: 60, windowMs: 60_000 },
  health: { limit: 30, windowMs: 60_000 },
} satisfies Record<string, RateRule>;

export type RateRuleName = keyof typeof rateRules;

export async function checkRate(name: RateRuleName, clientKey: string): Promise<RateResult> {
  return rateLimiter.limit(`${name}:${clientKey}`, rateRules[name]);
}
