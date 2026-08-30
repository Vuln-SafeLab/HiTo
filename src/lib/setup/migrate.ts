import { spawn } from "node:child_process";
import path from "node:path";

export type MigrateResult = { ok: true } | { ok: false; message: string };

// Strip connection strings from any output before returning — migration failures can echo credentials
function redactSecrets(text: string): string {
  return text
    .replace(/mysql:\/\/[^\s"']+/g, "mysql://***")
    .replace(/file:[^\s"']+ /g, "file:***");
}

// Invoke Prisma's JS entry directly instead of the .bin shim for cross-platform consistency (Windows .cmd requires shell, which introduces quote-escaping issues)
export async function runMigrateDeploy(databaseUrl: string): Promise<MigrateResult> {
  let last: MigrateResult = { ok: false, message: "migration did not run" };
  // SQLite single-writer: the wizard's own requests (rate-limit writes, probes) hold
  // the write lock while the migration child needs it exclusively. Retry transient
  // "database is locked" instead of surfacing a scary 500 the user can only fix by retrying.
  for (let attempt = 1; attempt <= 3; attempt++) {
    last = await runMigrateDeployOnce(databaseUrl);
    if (last.ok) return last;
    if (!/database is locked|SQLITE_BUSY/i.test(last.message)) return last;
    if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  return last;
}

async function runMigrateDeployOnce(databaseUrl: string): Promise<MigrateResult> {
  const prismaEntry = path.join(process.cwd(), "node_modules", "prisma", "build", "index.js");

  return await new Promise<MigrateResult>((resolve) => {
    const child = spawn(process.execPath, [prismaEntry, "migrate", "deploy"], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let output = "";
    child.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.on("error", (error) => {
      resolve({ ok: false, message: redactSecrets(error.message) });
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ ok: true });
      } else {
        const tail = redactSecrets(output).trim().slice(-800);
        resolve({ ok: false, message: tail });
      }
    });
  });
}
