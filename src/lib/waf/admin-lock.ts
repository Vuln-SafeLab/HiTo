// Admin lock (E2) node-side read/write: SystemConfig `waf.adminLockUntil` (ISO)
import { getDb } from "@/lib/db";
import { setWafConfig } from "@/lib/waf/config";

export async function getAdminLockUntil(): Promise<Date | null> {
  try {
    const row = await getDb().systemConfig.findUnique({
      where: { key: "waf.adminLockUntil" },
      select: { value: true },
    });
    if (row === undefined || row === null || row.value === "") return null;
    const date = new Date(row.value);
    return Number.isFinite(date.getTime()) && date > new Date() ? date : null;
  } catch {
    return null;
  }
}

export { setWafConfig };
