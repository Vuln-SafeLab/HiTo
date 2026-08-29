import { getDb } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/env";

const INSTALLED_KEY = "installed";

// One-way latch: once `installed` is true it never reverts. Cache only true.
let installedLatch = false;

export async function isInstalled(): Promise<boolean> {
  if (installedLatch) return true;
  if (!isDatabaseConfigured()) return false;
  try {
    const row = await getDb().systemConfig.findUnique({ where: { key: INSTALLED_KEY } });
    if (row?.value === "true") {
      installedLatch = true;
      return true;
    }
    return false;
  } catch {
    // DB unreachable / table missing — treat as not installed
    return false;
  }
}

export async function markInstalled(): Promise<void> {
  await getDb().systemConfig.upsert({
    where: { key: INSTALLED_KEY },
    update: { value: "true" },
    create: { key: INSTALLED_KEY, value: "true" },
  });
  installedLatch = true;
}

export async function isMigrated(): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;
  try {
    await getDb().user.count();
    return true;
  } catch {
    return false;
  }
}

export async function hasAdminUser(): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;
  try {
    const count = await getDb().user.count({ where: { role: "ADMIN" } });
    return count > 0;
  } catch {
    return false;
  }
}
