import { getDb } from "@/lib/db";

interface BanCache {
  ips: Set<string>;
  loadedAt: number;
}

// 10s in-process cache: bans are read on every login/click. Unban propagates within 10s — acceptable
const CACHE_TTL_MS = 10_000;

const globalForBans = globalThis as unknown as { ipBanCache?: BanCache };

export async function isIpBanned(ip: string): Promise<boolean> {
  const now = Date.now();
  let cached = globalForBans.ipBanCache;
  if (cached === undefined || now - cached.loadedAt > CACHE_TTL_MS) {
    try {
      const rows = await getDb().ipBan.findMany({
        where: { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
        select: { ip: true },
      });
      cached = { ips: new Set(rows.map((row) => row.ip)), loadedAt: now };
      globalForBans.ipBanCache = cached;
    } catch {
      // Fail-open on read error: ban table is a hardening layer, not a site-availability dependency
      return false;
    }
  }
  return cached.ips.has(ip);
}

export function invalidateIpBanCache(): void {
  globalForBans.ipBanCache = undefined;
}
