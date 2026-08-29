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
