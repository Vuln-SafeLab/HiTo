import { headers } from "next/headers";
import { getSessionUser, type SessionUser } from "@/lib/auth/guard";
import { getClientIdentifier } from "@/lib/security/ip";
import { checkRate } from "@/lib/security/rate-limit";

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; code: string };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail<T = undefined>(code: string): ActionResult<T> {
  return { ok: false, code };
}

export interface ActionContext {
  user: SessionUser;
  ip: string;
  userAgent: string;
}

export type GuardOutcome = { ok: true; ctx: ActionContext } | { ok: false; code: string };

export async function guardAction(adminOnly: boolean): Promise<GuardOutcome> {
  const user = await getSessionUser();
  if (user === null) return { ok: false, code: "unauthorized" };
  if (adminOnly && user.role !== "ADMIN") return { ok: false, code: "forbidden" };

  // Admin lock: reject all writes (incl. EDITOR/ADMIN) while locked
  const { getAdminLockUntil } = await import("@/lib/waf/admin-lock");
  const lockUntil = await getAdminLockUntil();
  if (lockUntil !== null) return { ok: false, code: "adminLocked" };

  const headerStore = await headers();
  const ip = await getClientIdentifier(headerStore);
  const rate = await checkRate("adminWrite", user.id);
  if (!rate.ok) return { ok: false, code: "rateLimited" };

  return {
    ok: true,
    ctx: { user, ip, userAgent: headerStore.get("user-agent") ?? "" },
  };
}
