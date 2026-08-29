import { LRUCache } from "lru-cache";
import { NextResponse, type NextRequest } from "next/server";
import { ENGINE_DEFAULTS, RULE_IDS, type EngineMode } from "./rules";
import { scanPayload, scanProbePath, scanStructure, decodeOnce, type ScanInput } from "./scanner";
import {
  CHALLENGE_COOKIE_NAMES,
  issueToken,
  newSeed,
  readChallengeCookies,
  verifyPow,
  verifyToken,
} from "./challenge";
import { render403, render429, renderChallenge } from "./page";
import { KUN_ICON_32_BASE64 } from "./icon-data";
import { buildInternalRequest, isInternalSignedRequest } from "./internal-client";

function envNum(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const MODE: EngineMode = (() => {
  const raw = process.env.SECURITY_ENGINE_MODE;
  return raw === "off" || raw === "block" || raw === "log" ? raw : ENGINE_DEFAULTS.MODE;
})();
const TRUST_PROXY = process.env.TRUST_PROXY === "true"; // false: degraded mode (no IP scoring)

interface RuntimeConfig {
  mode: EngineMode;
  underAttackQps: number;
  windowLimit: number;
  rulesDisabled: Set<string>;
  attackModeUntilMs: number;
}
const runtime: RuntimeConfig = {
  mode: MODE,
  underAttackQps: envNum("UNDER_ATTACK_QPS", ENGINE_DEFAULTS.UNDER_ATTACK_QPS),
  windowLimit: envNum("KUN_WINDOW_LIMIT", ENGINE_DEFAULTS.WINDOW_LIMIT),
  rulesDisabled: new Set(),
  attackModeUntilMs: 0,
};
const CHALLENGE_TTL = envNum("CHALLENGE_TTL", ENGINE_DEFAULTS.CHALLENGE_TTL);
const POW_PREFIX = ENGINE_DEFAULTS.POW_PREFIX;

if (process.env.NODE_ENV === "production" && !TRUST_PROXY) {
  console.warn(
    "[kun] TRUST_PROXY=false — IP-level ban/score disabled; content-only mode. " +
      "Put behind a reverse proxy in production and set TRUST_PROXY=true."
  );
}

interface KunState {
  verdictCache: LRUCache<string, { action: "allow" | "block"; status?: number; until: number; eventId: string }>;
  ipStates: LRUCache<string, { strikes: number; bannedUntil: number }>;
  windows: LRUCache<string, { count: number; windowStart: number }>;
  seeds: LRUCache<string, true>;
  qpsBuckets: Array<{ second: number; count: number }>;
  qpsTriggeredUntil: number;
  stats: Map<string, number>;
  reportThrottle: LRUCache<string, true>;
  releaseWatermark: number;
}
const globalForKun = globalThis as unknown as { kunState?: KunState };
const state: KunState =
  globalForKun.kunState ??
  (globalForKun.kunState = {
    verdictCache: new LRUCache({ max: 50_000 }),
    ipStates: new LRUCache({ max: 100_000 }),
    windows: new LRUCache({ max: 100_000 }),
    seeds: new LRUCache({ ttl: CHALLENGE_TTL * 1000, max: 20_000 }),
    qpsBuckets: [],
    qpsTriggeredUntil: 0,
    stats: new Map(),
    reportThrottle: new LRUCache({ ttl: 10_000, max: 5_000 }),
    releaseWatermark: 0,
  });

function bumpStat(ruleId: string): void {
  state.stats.set(ruleId, (state.stats.get(ruleId) ?? 0) + 1);
}

interface PulledConfig {
  mode: EngineMode;
  underAttackQps: number;
  windowLimit: number;
  rulesDisabled: string[];
  attackModeUntilMs: number;
  banReleases: Array<{ ipKey: string; seq: number }>;
}
let configCache: { value: PulledConfig | null; at: number } = { value: null, at: 0 };
let pullPromise: Promise<void> | null = null;

async function ensureFreshConfig(): Promise<void> {
  const stale = configCache.value === null || Date.now() - configCache.at > 2_000;
  if (!stale) return;
  if (pullPromise === null) {
    pullPromise = refreshRuntimeConfig()
      .then(() => pushBansAndTelemetry())
      .finally(() => { pullPromise = null; });
  }
  await pullPromise;
}

function applyPulled(value: PulledConfig): void {
  const modeChanged = runtime.mode !== value.mode;
  runtime.mode = value.mode;
  runtime.underAttackQps = value.underAttackQps;
  runtime.windowLimit = value.windowLimit;
  runtime.rulesDisabled = new Set(value.rulesDisabled);
  const attackModeExtended = value.attackModeUntilMs > runtime.attackModeUntilMs;
  runtime.attackModeUntilMs = value.attackModeUntilMs;
  if (modeChanged || attackModeExtended) {
    state.verdictCache.clear();
    state.reportThrottle.clear();
  }
  for (const release of value.banReleases) {
    if (release.seq > state.releaseWatermark) {
      state.ipStates.delete(release.ipKey);
      state.releaseWatermark = Math.max(state.releaseWatermark, release.seq);
    }
  }
  configCache = { value, at: Date.now() };
}

async function refreshRuntimeConfig(): Promise<void> {
  try {
    const built = await buildInternalRequest("/api/internal/waf/config", "");
    if (built === null) return;
    const res = await fetch(built.url, built.init).catch(() => null);
    if (res === null || !res.ok) return;
    const data: unknown = await res.json().catch(() => null);
    if (
      typeof data !== "object" || data === null ||
      (data as { ok?: unknown }).ok !== true
    ) return;
    const cfg = (data as { config?: Partial<PulledConfig> }).config ?? {};
    applyPulled({
      mode:
        cfg.mode === "off" || cfg.mode === "block" || cfg.mode === "log"
          ? cfg.mode
          : runtime.mode,
      underAttackQps:
        typeof cfg.underAttackQps === "number" && cfg.underAttackQps > 0
          ? cfg.underAttackQps
          : runtime.underAttackQps,
      windowLimit:
        typeof cfg.windowLimit === "number" && cfg.windowLimit > 0
          ? cfg.windowLimit
          : runtime.windowLimit,
      rulesDisabled: Array.isArray(cfg.rulesDisabled)
        ? cfg.rulesDisabled.filter((x): x is string => typeof x === "string")
        : [],
      attackModeUntilMs:
        typeof cfg.attackModeUntilMs === "number" ? cfg.attackModeUntilMs : 0,
      banReleases: Array.isArray(cfg.banReleases)
        ? (cfg.banReleases as Array<{ ipKey: string; seq: number }>).filter(
            (r) => typeof r?.ipKey === "string" && typeof r?.seq === "number"
          )
        : [],
    });
  } catch { /* pull failure: keep previous cache */ }
}

function shouldReport(ruleId: string, ip: string): boolean {
  const key = `${ruleId}|${ip}`;
  if (state.reportThrottle.has(key)) return false;
  state.reportThrottle.set(key, true);
  return true;
}
function fireReport(event: {
  eventId: string; ruleId: string; action: string;
  ip: string; path: string; method: string; ua: string; sample?: string;
}): void {
  void (async () => {
    try {
      const body = JSON.stringify({ events: [event] });
      const built = await buildInternalRequest("/api/internal/waf/report", body);
      if (built === null) return;
      await fetch(built.url, built.init).catch(() => undefined);
    } catch { /* observation channel must never affect main flow */ }
  })();
}

let lastSnapshotAt = 0;
async function pushBansAndTelemetry(): Promise<void> {
  const now = Date.now();
  if (now - lastSnapshotAt < 10_000) return;
  lastSnapshotAt = now;
  try {
    const bans = Array.from(state.ipStates.entries())
      .filter(([, v]) => v.bannedUntil > now)
      .sort((a, b) => b[1].bannedUntil - a[1].bannedUntil)
      .slice(0, 20)
      .map(([ipKey, v]) => ({ ipKey, bannedUntil: v.bannedUntil, strikes: v.strikes }));
    const topRules = Array.from(state.stats.entries())
      .map(([ruleId, count]) => ({ ruleId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
    const telemetry = { qps: state.qpsBuckets[state.qpsBuckets.length - 1]?.count ?? 0, at: now, topRules };
    const body = JSON.stringify({ bans, telemetry });
  const built = await buildInternalRequest("/api/internal/waf/bans", body);
    if (built !== null) await fetch(built.url, built.init).catch(() => undefined);
  } catch { /* silent */ }
}

function normalizeIp(raw: string): string {
  const v = raw.trim();
  const unMapped = v.toLowerCase().startsWith("::ffff:") ? v.slice(7) : v;
  if (unMapped.includes(":")) {
    const parts = unMapped.split(":");
    return `${parts.slice(0, 4).join(":")}::/64`;
  }
  return unMapped;
}
function ipKey(headers: Headers): string {
  if (!TRUST_PROXY) return "direct";
  const xff = headers.get("x-forwarded-for");
  if (xff !== null && xff.trim() !== "") {
    const segs = xff.split(",").map((s) => s.trim()).filter(Boolean);
    const rightmost = segs[segs.length - 1];
    if (rightmost !== undefined) return normalizeIp(rightmost);
  }
  const real = headers.get("x-real-ip");
  if (real !== null && real.trim() !== "") return normalizeIp(real);
  return "127.0.0.1";
}

function fingerprint(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}
function newEventId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function checkGlobalQps(): boolean {
  const nowSecond = Math.floor(Date.now() / 1000);
  const buckets = state.qpsBuckets;
  const last = buckets[buckets.length - 1];
  if (last === undefined || last.second !== nowSecond) {
    buckets.push({ second: nowSecond, count: 1 });
    if (buckets.length > 60) buckets.shift();
  } else {
    last.count += 1;
  }
  if (state.qpsTriggeredUntil > Date.now()) return true;
  if (runtime.attackModeUntilMs > Date.now()) return true;
  const currentQps = last?.count ?? 0;
  if (currentQps > runtime.underAttackQps) {
    state.qpsTriggeredUntil = Date.now() + 120_000;
    console.error(`[kun] QPS ${currentQps} > ${runtime.underAttackQps} — entering under-attack mode 120s`);
    return true;
  }
  return false;
}

function ccScore(ipKeyValue: string): { banned: boolean; retryAfterSeconds?: number } {
  const now = Date.now();
  const banState = state.ipStates.get(ipKeyValue);
  if (banState !== undefined && banState.bannedUntil > now) {
    return { banned: true, retryAfterSeconds: Math.ceil((banState.bannedUntil - now) / 1000) };
  }
  const win = state.windows.get(ipKeyValue);
  if (win === undefined || now - win.windowStart > ENGINE_DEFAULTS.WINDOW_MS) {
    state.windows.set(ipKeyValue, { count: 1, windowStart: now });
    return { banned: false };
  }
  win.count += 1;
  if (win.count > runtime.windowLimit) {
    const strikes = (banState?.strikes ?? 0) + 1;
    const banMs = Math.min(
      ENGINE_DEFAULTS.BAN_BASE_MS * 2 ** strikes,
      ENGINE_DEFAULTS.BAN_MAX_MS
    );
    state.ipStates.set(ipKeyValue, { strikes, bannedUntil: now + banMs });
    state.windows.set(ipKeyValue, { count: 0, windowStart: now });
    bumpStat(RULE_IDS.CC_BAN);
    return { banned: true, retryAfterSeconds: Math.ceil(banMs / 1000) };
  }
  return { banned: false };
}

export type KunAction =
  | { action: "allow" }
  | { action: "log"; ruleId: string }
  | {
      action: "block";
      status: 403 | 429;
      variant: "403" | "429";
      eventId: string;
      retryAfterSeconds?: number;
    }
  | { action: "challenge"; eventId: string; seed: string; returnTo: string }
  | { action: "challenge-pass"; eventId: string; tokenToIssue: string; seed: string };

const JWT_RE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const looksLikeJwt = (v: string): boolean => v.length > 20 && v.split(".").length === 3 && JWT_RE.test(v);

export async function inspectRequest(request: NextRequest): Promise<KunVerdict> {
  try {
    if (MODE === "off") return { action: "allow" };
    if (await isInternalSignedRequest(request)) return { action: "allow" };
    await ensureFreshConfig();
    if (runtime.mode === "off") return { action: "allow" };

    const method = request.method.toUpperCase();
    const pathname = request.nextUrl.pathname;
    const search = request.nextUrl.search ?? "";

    const manualUnderAttack = runtime.attackModeUntilMs > Date.now();
    const underAttack = checkGlobalQps() || manualUnderAttack;
    const cookies = readChallengeCookies(request);
    if (cookies.token !== undefined) {
      const ok = await verifyToken(cookies.token, cookies.seed, CHALLENGE_TTL);
      if (ok) return { action: "allow" };
    }

    const ipKeyValue = ipKey(request.headers);
    if (TRUST_PROXY && ipKeyValue !== "direct") {
      const ccEarly = ccScore(ipKeyValue);
      if (ccEarly.banned) {
        bumpStat(RULE_IDS.CC_BAN);
        const eventId = newEventId();
        const retryAfterSeconds = ccEarly.retryAfterSeconds ?? 30;
        if (shouldReport(RULE_IDS.CC_BAN, ipKeyValue)) {
          fireReport({
            eventId, ruleId: RULE_IDS.CC_BAN, action: "ban",
            ip: ipKeyValue, path: pathname.slice(0, 512), method,
            ua: request.headers.get("user-agent") ?? "",
            sample: `strikes=${state.ipStates.get(ipKeyValue)?.strikes ?? "?"}`,
          });
        }
        return {
          action: "block", status: 429, variant: "429",
          eventId, retryAfterSeconds,
        };
      }
    }

    if (underAttack) {
      if (
        cookies.seed !== undefined && cookies.seed !== "" &&
        cookies.nonce !== undefined && cookies.nonce !== "" &&
        state.seeds.has(cookies.seed)
      ) {
        const powOk = await verifyPow(cookies.seed, cookies.nonce, POW_PREFIX);
        if (powOk) {
          state.seeds.delete(cookies.seed);
          const token = await issueToken(cookies.seed, CHALLENGE_TTL);
          return {
            action: "challenge-pass",
            eventId: newEventId(),
            tokenToIssue: token,
            seed: cookies.seed,
          };
        }
      }
      const seed = await newSeed();
      state.seeds.set(seed, true);
      bumpStat(RULE_IDS.GLOBAL_QPS);
      return {
        action: "challenge",
        eventId: newEventId(),
        seed,
        returnTo: `${pathname}${search}`.slice(0, 512),
      };
    }

    const key = fingerprint(`${ipKeyValue}|${method}|${pathname}|${search}`);
    const cached = state.verdictCache.get(key);
    if (cached !== undefined) {
      if (cached.action === "block") {
        bumpStat("cache.block");
        if (cached.status === 429) {
          return {
            action: "block", status: 429, variant: "429",
            eventId: cached.eventId,
            retryAfterSeconds: Math.max(1, Math.ceil((cached.until - Date.now()) / 1000)),
          };
        }
        return { action: "block", status: 403, variant: "403", eventId: cached.eventId };
      }
      return { action: "allow" };
    }

    const headerSampleRaw = [
      request.headers.get("user-agent") ?? "",
      request.headers.get("referer") ?? "",
      cookies.nonce ?? "",
    ].join("|");
    const scanInput: ScanInput = {
      method,
      pathname,
      search,
      headerSample:
        headerSampleRaw.length <= ENGINE_DEFAULTS.SCAN_TRUNCATE
          ? headerSampleRaw
          : headerSampleRaw.slice(0, ENGINE_DEFAULTS.SCAN_TRUNCATE),
      cookieHasSession: looksLikeJwt(request.cookies.get("navsite_access")?.value ?? "")
        || looksLikeJwt(request.cookies.get("navsite_refresh")?.value ?? ""),
    };

    let hit: { ruleId: string } | null = scanStructure(scanInput);
    if (
      hit === null &&
      !runtime.rulesDisabled.has("K2.probe")
    ) {
      hit = scanProbePath(pathname, runtime.rulesDisabled);
    }
    if (hit === null && !runtime.rulesDisabled.has("K3.payload")) {
      hit = scanPayload(scanInput);
    }

    if (hit !== null) {
      bumpStat(hit.ruleId);
      const eventId = newEventId();
      const action = runtime.mode === "log" ? "log" : "block";
      if (shouldReport(hit.ruleId, ipKeyValue)) {
        fireReport({
          eventId, ruleId: hit.ruleId, action,
          ip: ipKeyValue,
          path: `${pathname}${search}`.slice(0, 512),
          method,
          ua: request.headers.get("user-agent") ?? "",
          sample: `${decodeOnce(pathname + search)}${headerSampleRaw.slice(0, 60)}`.slice(0, 512),
        });
      }
      if (action === "log") {
        return { action: "log", ruleId: hit.ruleId };
      }
      state.verdictCache.set(key, {
        action: "block", status: 403, until: Date.now() + 60_000, eventId,
      });
      return { action: "block", status: 403, variant: "403", eventId };
    }

    state.verdictCache.set(key, { action: "allow", until: Date.now() + 15_000, eventId: "" });
    return { action: "allow" };
  } catch (error) {
    console.error(
      "[kun] engine error (fail-open):",
      error instanceof Error ? error.message.slice(0, 200) : error
    );
    return { action: "allow" };
  }
}

type KunVerdict = KunAction;

export function kunResponse(verdict: KunVerdict): NextResponse {
  const base = {
    iconBase64: KUN_ICON_32_BASE64,
    eventId: "evt-" + (("eventId" in verdict ? verdict.eventId : "") || newEventId()),
  };
  if (verdict.action === "challenge") {
    const res = new NextResponse(
      renderChallenge(
        {
          variant: "challenge",
          ...base,
          seed: verdict.seed,
          powPrefix: POW_PREFIX,
          returnTo: verdict.returnTo,
        },
        verdict.seed
      ),
      {
        status: 403,
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-store",
          "x-robots-tag": "noindex, nofollow",
        },
      }
    );
    res.cookies.set(CHALLENGE_COOKIE_NAMES.seed, verdict.seed, {
      path: "/", maxAge: CHALLENGE_TTL, sameSite: "lax", httpOnly: false,
    });
    return res;
  }
  if (verdict.action === "block") {
    const html =
      verdict.variant === "429"
        ? render429({ variant: "429", ...base, retryAfterSeconds: verdict.retryAfterSeconds })
        : render403({ variant: "403", ...base });
    return new NextResponse(html, {
      status: verdict.status,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
        "x-robots-tag": "noindex, nofollow",
        ...(verdict.status === 429 && verdict.retryAfterSeconds !== undefined
          ? { "retry-after": String(verdict.retryAfterSeconds) }
          : {}),
      },
    });
  }
  return new NextResponse(null, { status: 200 });
}

export function applyPassIssue(response: NextResponse, verdict: KunVerdict): void {
  if (verdict.action === "challenge-pass") {
    response.cookies.set(CHALLENGE_COOKIE_NAMES.token, verdict.tokenToIssue, {
      path: "/",
      maxAge: CHALLENGE_TTL,
      sameSite: "lax",
      httpOnly: true,
    });
    response.cookies.delete(CHALLENGE_COOKIE_NAMES.seed);
    response.cookies.delete(CHALLENGE_COOKIE_NAMES.nonce);
  }
}

export function kunStatsSnapshot(): Record<string, number> {
  return Object.fromEntries(state.stats);
}
