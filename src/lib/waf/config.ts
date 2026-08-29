// SystemConfig waf.* key family; under SQLite single-writer these are lightweight single-row ops
import { getDb } from "@/lib/db";

export type WafMode = "off" | "log" | "block";

export interface WafRuntimeConfig {
  mode: WafMode;
  /** true when a waf.mode row exists in the DB (admin hot-switch); false = env/default */
  modeConfigured: boolean;
  underAttackQps: number;
  challengeTtl: number;
  windowLimit: number;
  rulesDisabled: string[];
  attackModeUntil: string | null;
}

export interface KunBanEntry {
  ipKey: string;
  bannedUntil: number; // epoch ms
  strikes: number;
}

export interface KunTelemetry {
  qps: number;
  at: number;
  topRules: Array<{ ruleId: string; count: number }>;
}

const PREFIX = "waf.";

const DEFAULTS: WafRuntimeConfig = {
  mode: "log",
  modeConfigured: false,
  underAttackQps: 600,
  challengeTtl: 600,
  windowLimit: 300,
  rulesDisabled: [],
  attackModeUntil: null,
};

async function readKeys(keys: string[]): Promise<Map<string, string>> {
  const rows = await getDb().systemConfig.findMany({
    where: { key: { in: keys.map((k) => PREFIX + k) } },
    select: { key: true, value: true },
  });
  return new Map(rows.map((r) => [r.key.slice(PREFIX.length), r.value]));
}

export async function getWafRuntimeConfig(): Promise<WafRuntimeConfig> {
  const map = await readKeys(Object.keys(DEFAULTS));
  const num = (key: string, fallback: number): number => {
    const n = Number(map.get(key));
    return Number.isFinite(n) && n > 0 ? n : fallback;
  };
  let rulesDisabled = DEFAULTS.rulesDisabled;
  try {
    const parsed: unknown = JSON.parse(map.get("rulesDisabled") ?? "[]");
    if (Array.isArray(parsed)) rulesDisabled = parsed.filter((x): x is string => typeof x === "string");
  } catch { /* fall back to default on bad value */ }
  const rawMode = map.get("mode");
  const modeConfigured = rawMode !== undefined;
  const mode: WafMode =
    rawMode === "off" || rawMode === "block" || rawMode === "log" ? rawMode : DEFAULTS.mode;
  const attackRaw = map.get("attackModeUntil") ?? "";
  return {
    mode,
    modeConfigured,
    underAttackQps: num("underAttackQps", DEFAULTS.underAttackQps),
    challengeTtl: num("challengeTtl", DEFAULTS.challengeTtl),
    windowLimit: num("windowLimit", DEFAULTS.windowLimit),
    rulesDisabled,
    attackModeUntil: attackRaw !== "" ? attackRaw : null,
  };
}

export async function setWafConfig(key: keyof WafRuntimeConfig | string, value: string): Promise<void> {
  await getDb().systemConfig.upsert({
    where: { key: PREFIX + key },
    update: { value },
    create: { key: PREFIX + key, value },
  });
}

export async function saveKunSnapshot(bansJson: string, telemetryJson: string): Promise<void> {
  await getDb().$transaction([
    getDb().systemConfig.upsert({
      where: { key: PREFIX + "kunBansSnapshot" },
      update: { value: bansJson },
      create: { key: PREFIX + "kunBansSnapshot", value: bansJson },
    }),
    getDb().systemConfig.upsert({
      where: { key: PREFIX + "telemetry" },
      update: { value: telemetryJson },
      create: { key: PREFIX + "telemetry", value: telemetryJson },
    }),
  ]);
}

export async function getKunBansSnapshot(): Promise<KunBanEntry[]> {
  try {
    const row = await getDb().systemConfig.findUnique({
      where: { key: PREFIX + "kunBansSnapshot" },
      select: { value: true },
    });
    if (row === undefined || row === null) return [];
    const parsed: unknown = JSON.parse(row.value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is KunBanEntry =>
        typeof x === "object" && x !== null &&
        typeof (x as KunBanEntry).ipKey === "string" &&
        typeof (x as KunBanEntry).bannedUntil === "number"
    );
  } catch {
    return [];
  }
}

export async function getTelemetry(): Promise<KunTelemetry | null> {
  try {
    const row = await getDb().systemConfig.findUnique({
      where: { key: PREFIX + "telemetry" },
      select: { value: true },
    });
    if (row === undefined || row === null) return null;
    const parsed: unknown = JSON.parse(row.value);
    if (typeof parsed !== "object" || parsed === null) return null;
    const t = parsed as KunTelemetry;
    return typeof t.qps === "number" ? t : null;
  } catch {
    return null;
  }
}
