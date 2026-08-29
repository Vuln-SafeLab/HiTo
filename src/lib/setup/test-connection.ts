import { promises as fs } from "node:fs";
import path from "node:path";
import { getDb } from "@/lib/db";

export interface TestResult {
  ok: boolean;
  /** Probe info on success; stable error code for display on failure */
  code?: string;
  message?: string;
  probeKey?: string;
}

export function resolveSqliteTarget(dataDir: string): { dir: string; databaseUrl: string } | null {
  const normalized = dataDir.replace(/\\/g, "/").replace(/\/+$/, "");
  if (normalized === "" || normalized.includes("..")) return null;
  const dir = path.resolve(process.cwd(), normalized);
  // Defensive: resolved path must still be inside cwd
  const cwd = path.resolve(process.cwd());
  if (!(dir + path.sep).startsWith(cwd + path.sep)) return null;
  return { dir, databaseUrl: `file:${dir.replace(/\\/g, "/")}/navsite.db?connection_limit=1` };
}

export async function testSqliteConnection(databaseUrl: string): Promise<TestResult> {
  void databaseUrl;
  try {
    const db = getDb();
    await db.$queryRaw`SELECT 1`;
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      code: "dbUnreachable",
      message: error instanceof Error ? error.message.slice(0, 300) : "unknown",
    };
  }
}

export async function probeSqliteWrite(): Promise<TestResult> {
  try {
    const db = getDb();
    const probeKey = `setup.probe.${Date.now()}`;
    await db.systemConfig.create({ data: { key: probeKey, value: "ok" } });
    const readBack = await db.systemConfig.findUnique({ where: { key: probeKey } });
    await db.systemConfig.delete({ where: { key: probeKey } }).catch(() => undefined);
    if (readBack?.value !== "ok") {
      return { ok: false, code: "dbUnknown", message: "probe round-trip mismatch" };
    }
    return { ok: true, probeKey };
  } catch (error) {
    return {
      ok: false,
      code: "dbUnknown",
      message: error instanceof Error ? error.message.slice(0, 300) : "unknown",
    };
  }
}

export async function ensureDataDir(dir: string): Promise<{ ok: boolean; code?: string }> {
  try {
    await fs.mkdir(dir, { recursive: true });
    const probe = path.join(dir, `.write-probe-${Date.now()}`);
    await fs.writeFile(probe, "ok");
    await fs.rm(probe, { force: true });
    return { ok: true };
  } catch {
    return { ok: false, code: "envWriteFailed" };
  }
}
