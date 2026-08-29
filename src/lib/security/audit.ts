import { getDb } from "@/lib/db";

export interface AuditEntry {
  userId?: string | null;
  username: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  detail?: unknown;
  ip: string;
  userAgent: string;
}

export async function writeAudit(entry: AuditEntry): Promise<void> {
  try {
    await getDb().auditLog.create({
      data: {
        userId: entry.userId ?? null,
        username: entry.username,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId ?? null,
        detail: entry.detail === undefined ? null : JSON.stringify(entry.detail),
        ip: entry.ip,
        userAgent: entry.userAgent.slice(0, 512),
      },
    });
  } catch (error) {
    console.error("[audit] write failed:", error instanceof Error ? error.message : error);
  }
}
