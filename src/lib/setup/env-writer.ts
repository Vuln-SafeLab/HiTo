import { randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { resetEnvCache } from "@/lib/env";

const ENV_PATH = path.join(process.cwd(), ".env");

// Atomic .env write: temp file + rename. Windows Node rename uses MoveFileEx REPLACE_EXISTING (atomic). Unrelated existing vars preserved; only given keys overwritten
export async function writeEnvVars(vars: Record<string, string>): Promise<void> {
  let existing = "";
  try {
    existing = await fs.readFile(ENV_PATH, "utf8");
  } catch {
    // Missing .env is normal for a fresh install
  }

  const keysToWrite = new Set(Object.keys(vars));
  const keptLines = existing
    .split(/\r?\n/)
    .filter((line) => {
      const match = line.match(/^([A-Z0-9_]+)\s*=/);
      return !(match?.[1] && keysToWrite.has(match[1]));
    });
  while (keptLines.length > 0 && keptLines[keptLines.length - 1]?.trim() === "") {
    keptLines.pop();
  }

  const renderedLines = Object.entries(vars).map(
    ([key, value]) => `${key}="${value.replaceAll('"', '\\"')}"`
  );
  const content = [...keptLines, ...renderedLines, ""].join("\n");

  const tmpPath = `${ENV_PATH}.tmp`;
  await fs.writeFile(tmpPath, content, "utf8");
  await fs.rename(tmpPath, ENV_PATH);
  await fs.chmod(ENV_PATH, 0o600).catch(() => undefined);

  // Sync in-process env so subsequent wizard steps see new values
  for (const [key, value] of Object.entries(vars)) {
    process.env[key] = value;
  }
  resetEnvCache();
}

export function generateSecret(bytes = 48): string {
  return randomBytes(bytes).toString("base64");
}

// SQLite URL: dataDir is whitelisted by zod; normalize to forward slashes for Windows Prisma. Single connection -> serialized writes
export function buildDatabaseUrl(config: { dataDir: string }): string {
  const dir = path.resolve(process.cwd(), config.dataDir.replace(/\\/g, "/")).replace(/\\/g, "/");
  // Historical filename (retained across brand rename): do not rename old DBs
  return `file:${dir}/navsite.db?connection_limit=1`;
}
