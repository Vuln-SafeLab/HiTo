// Kun attack log queries and aggregations (node-side; all use indexes + LIMIT)
import { getDb } from "@/lib/db";

export interface WafTrendPoint {
  day: string;
  count: number;
}

export interface WafDistItem {
  ruleId: string;
  action: string;
  total: number;
}

export interface WafTopIp {
  ip: string;
  total: number;
}

export async function getWafTrend7d(): Promise<WafTrendPoint[]> {
  // Prisma stores SQLite DateTime as INTEGER unixepoch-ms; naive text comparisons
  // against datetime('now',…) silently match nothing (INTEGER < TEXT always).
  // All windows below therefore compare against integer-millisecond anchors.
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - 6);
  const sinceMs = since.getTime();
  const rows = await getDb().$queryRaw<Array<{ day: string; total: number }>>`
    SELECT strftime('%Y-%m-%d', at / 1000, 'unixepoch', 'localtime') AS day, COUNT(*) AS total
    FROM waf_events
    WHERE at >= ${sinceMs}
    GROUP BY day
    ORDER BY day ASC
  `;
  const map = new Map(rows.map((r) => [r.day, Number(r.total)]));
  const points: WafTrendPoint[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    points.push({ day: key, count: map.get(key) ?? 0 });
  }
  return points;
}

export async function getWafDistribution(): Promise<WafDistItem[]> {
  const rows = await getDb().$queryRaw<Array<{ ruleId: string; action: string; total: number }>>`
    SELECT ruleId, action, COUNT(*) AS total
    FROM waf_events
    WHERE at >= (strftime('%s', 'now', '-1 day') * 1000)
    GROUP BY ruleId, action
    ORDER BY total DESC
    LIMIT 12
  `;
  return rows.map((r) => ({ ruleId: r.ruleId, action: r.action, total: Number(r.total) }));
}

export async function getWafTopIps(): Promise<WafTopIp[]> {
  const rows = await getDb().$queryRaw<Array<{ ip: string; total: number }>>`
    SELECT ip, COUNT(*) AS total
    FROM waf_events
    WHERE at >= (strftime('%s', 'now', '-1 day') * 1000)
    GROUP BY ip
    ORDER BY total DESC
    LIMIT 10
  `;
  return rows.map((r) => ({ ip: r.ip, total: Number(r.total) }));
}

export async function getTodayTotal(): Promise<number> {
  const rows = await getDb().$queryRaw<Array<{ n: number }>>`
    SELECT COUNT(*) AS n FROM waf_events
    WHERE at >= (strftime('%s', 'now', 'localtime', 'start of day') * 1000)
  `;
  return Number(rows[0]?.n ?? 0);
}
