import { promises as fs, constants as fsConstants } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { getEnv, isAuthConfigured, isDatabaseConfigured } from "@/lib/env";
import { hasAdminUser, isInstalled, isMigrated } from "@/lib/setup/state";

// middleware probes this on every pre-install request: must be dynamic and cheap.
export const dynamic = "force-dynamic";

const REQUIRED_NODE = { major: 20, minor: 9 };

function checkNode(): { ok: boolean; version: string } {
  const version = process.versions.node;
  const [major = 0, minor = 0] = version.split(".").map(Number);
  const ok =
    major > REQUIRED_NODE.major ||
    (major === REQUIRED_NODE.major && minor >= REQUIRED_NODE.minor);
  return { ok, version };
}

async function checkWritable(dir: string): Promise<boolean> {
  try {
    await fs.mkdir(dir, { recursive: true });
    await fs.access(dir, fsConstants.W_OK);
    return true;
  } catch {
    return false;
  }
}

export async function GET(): Promise<NextResponse> {
  // Once installed, only return a boolean: node version / dir writability / env vars / DB state
  // are deployment fingerprints and must not be exposed publicly (red-team verified info leak).
  if (await isInstalled()) {
    return NextResponse.json({ installed: true });
  }

  const env = getEnv();
  const [migrated, adminExists, envWritable, uploadWritable] = await Promise.all([
    isMigrated(),
    hasAdminUser(),
    checkWritable(process.cwd()),
    checkWritable(path.resolve(process.cwd(), env.UPLOAD_DIR)),
  ]);

  return NextResponse.json({
    installed: false,
    checks: {
      node: checkNode(),
      envWrite: { ok: envWritable },
      uploadWrite: { ok: uploadWritable },
      vars: {
        databaseUrl: isDatabaseConfigured(),
        authSecret: isAuthConfigured(),
      },
    },
    db: {
      configured: isDatabaseConfigured(),
      migrated,
      adminExists,
    },
  });
}
