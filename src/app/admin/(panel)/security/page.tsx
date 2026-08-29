import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { WafConsole } from "@/components/admin/waf-console";
import type {
  AuditLogItem,
  IpBanItem,
  SessionItem,
  WafEventItem,
} from "@/components/admin/types";
import { requireAdmin } from "@/lib/auth/guard";
import { lookupCountryCode, COUNTRY_CENTROIDS } from "@/lib/security/geoip";
import { getDb } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { rateRules } from "@/lib/security/rate-limit";
import {
  getKunBansSnapshot,
  getTelemetry,
  getWafRuntimeConfig,
} from "@/lib/waf/config";
import {
  getWafDistribution,
  getWafTopIps,
  getWafTrend7d,
  getTodayTotal,
} from "@/lib/waf/repo";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.nav");
  return { title: t("security") };
}

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;
/** Default protected-node location for map arcs: Beijing */
const DEFAULT_SERVER_GEO: [number, number] = [116.4, 39.9];

interface SecurityPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function SecurityPage({ searchParams }: SecurityPageProps) {
  await requireAdmin();

  const params = await searchParams;
  const ruleFilter = firstParam(params.rule).slice(0, 32);
  const actionFilter = firstParam(params.wafAction).slice(0, 16);
  const ipFilter = firstParam(params.ip).slice(0, 64);
  const page = Math.max(1, Number.parseInt(firstParam(params.page), 10) || 1);

  const db = getDb();
  const wafWhere = {
    ...(ruleFilter !== "" ? { ruleId: { contains: ruleFilter } } : {}),
    ...(actionFilter !== "" ? { action: actionFilter } : {}),
    ...(ipFilter !== "" ? { ip: { contains: ipFilter } } : {}),
  };

  const [
    trend,
    distribution,
    topIps,
    todayTotal,
    wafRows,
    wafTotal,
    kunBans,
    telemetry,
    runtimeConfig,
    auditRows,
    sessionRows,
    banRows,
  ] = await Promise.all([
    getWafTrend7d(),
    getWafDistribution(),
    getWafTopIps(),
    getTodayTotal(),
    db.wafEvent.findMany({
      where: wafWhere,
      orderBy: { at: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.wafEvent.count({ where: wafWhere }),
    getKunBansSnapshot(),
    getTelemetry(),
    getWafRuntimeConfig(),
    db.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: Math.min(PAGE_SIZE, 20),
      select: {
        id: true, username: true, action: true, targetType: true,
        targetId: true, detail: true, ip: true, userAgent: true, createdAt: true,
      },
    }),
    db.session.findMany({
      where: { revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastUsedAt: "desc" },
      take: 50,
      include: { user: { select: { username: true } } },
    }),
    db.ipBan.findMany({ orderBy: { createdAt: "desc" }, take: 200 }),
  ]);

  const wafEvents: WafEventItem[] = wafRows.map((row) => ({
    id: row.id,
    eventId: row.eventId,
    at: row.at.toISOString(),
    ruleId: row.ruleId,
    action: row.action,
    ip: row.ip,
    path: row.path,
    method: row.method,
    ua: row.ua,
    sample: row.sample,
    count: row.count,
    acknowledgedAt: row.acknowledgedAt?.toISOString() ?? null,
  }));

  const audit: AuditLogItem[] = auditRows.map((row) => ({
    id: String(row.id),
    username: row.username,
    action: row.action,
    targetType: row.targetType,
    targetId: row.targetId,
    detail: row.detail,
    ip: row.ip,
    userAgent: row.userAgent,
    createdAt: row.createdAt.toISOString(),
  }));
  
  const sessions: SessionItem[] = sessionRows.map((row) => ({
    id: row.id,
    username: row.user.username,
    ip: row.ip,
    userAgent: row.userAgent,
    createdAt: row.createdAt.toISOString(),
    lastUsedAt: row.lastUsedAt.toISOString(),
    isCurrent: false,
  }));

  const bans: IpBanItem[] = banRows.map((row) => ({
    id: row.id,
    ip: row.ip,
    reason: row.reason,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt?.toISOString() ?? null,
  }));

  const rules = Object.entries(rateRules).map(([name, rule]) => ({
    name,
    limit: rule.limit,
    windowSeconds: rule.windowMs / 1000,
  }));

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const wafAll7d = await db.wafEvent.findMany({
    where: { at: { gte: sevenDaysAgo } },
    select: { ip: true, count: true, at: true, action: true },
  });
  const ccAgg: Record<string, { total: number; lastAt: string; actions: Record<string, number> }> = {};
  for (const e of wafAll7d) {
    const cc = lookupCountryCode(e.ip);
    if (!cc) continue;
    const bucket = (ccAgg[cc] ??= { total: 0, lastAt: e.at.toISOString(), actions: {} });
    bucket.total += e.count;
    bucket.actions[e.action] = (bucket.actions[e.action] ?? 0) + e.count;
    if (e.at > new Date(bucket.lastAt)) bucket.lastAt = e.at.toISOString();
  }
  const mapData = Object.entries(ccAgg).map(([cc, d]) => {
    const centroids = COUNTRY_CENTROIDS[cc];
    if (!centroids) return null;
    const [lng, lat] = centroids;
    const topAction = Object.entries(d.actions).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "block";
    return { cc, total: d.total, lastAt: d.lastAt, lng, lat, size: Math.min(5, Math.ceil(Math.log2(d.total + 1))), topAction };
  }).filter((v): v is NonNullable<typeof v> => v !== null);

  // Live feed: 10 most recent events with resolved country codes
  const recentHits = wafEvents.slice(0, 10).map((e) => ({
    id: e.id,
    at: e.at,
    ip: e.ip,
    ruleId: e.ruleId,
    action: e.action,
    cc: lookupCountryCode(e.ip),
  }));

  const geoRaw = getEnv().WAF_SERVER_GEO;
  const [serverLng, serverLat] = geoRaw !== undefined
    ? (geoRaw.split(",").map((v) => Number(v.trim())) as [number, number])
    : DEFAULT_SERVER_GEO;

  return (
    <WafConsole
      trend={trend}
      distribution={distribution}
      topIps={topIps}
      todayTotal={todayTotal}
      events={wafEvents}
      eventTotal={wafTotal}
      eventPage={page}
      eventPageSize={PAGE_SIZE}
      filters={{ ruleId: ruleFilter, action: actionFilter, ip: ipFilter }}
      kunBans={kunBans}
      manualAttackUntil={runtimeConfig.attackModeUntil}
      telemetryQps={telemetry?.qps ?? null}
      audit={audit}
      sessions={sessions}
      ipBans={bans}
      rules={rules}
      mapData={mapData}
      recentHits={recentHits}
      serverLng={serverLng}
      serverLat={serverLat}
    />
  );
}
