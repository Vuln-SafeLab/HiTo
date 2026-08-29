import { CommandPalette } from "@/components/admin/command-palette";
import { SessionKeeper } from "@/components/admin/session-keeper";
import { Sidebar } from "@/components/admin/sidebar";
import { UserMenu } from "@/components/admin/user-menu";
import { KunAlertModalSlot } from "@/components/admin/kun-alert-modal-slot";
import { LocaleSwitcher } from "@/components/shared/locale-switcher";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { requireUser } from "@/lib/auth/guard";
import { getAdminLockUntil } from "@/lib/waf/admin-lock";
import { redirect } from "next/navigation";

// (panel) route group: login is outside it, so it isn't wrapped by this layout (guards would redirect-loop).
export default async function AdminPanelLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Real auth boundary: middleware only does a cookie-existence coarse check.
  const user = await requireUser();

  // E2 lock gate: all admin routes redirect to the lock page during lockout.
  const lockUntil = await getAdminLockUntil();
  if (lockUntil !== null) {
    redirect("/admin/locked");
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar role={user.role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-border bg-background/80 px-4 backdrop-blur sm:px-6">
          <CommandPalette role={user.role} />
          <div className="flex items-center gap-1">
            <LocaleSwitcher />
            <ThemeToggle />
            <UserMenu username={user.username} role={user.role} />
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
      <SessionKeeper />
      <AlertModalSlot />
    </div>
  );
}

/** E1 attack alert modal: server-side fetch of unacknowledged events; renders nothing if none. */
async function AlertModalSlot() {
  try {
    const db = (await import("@/lib/db")).getDb();
    const latest = await db.wafEvent.findFirst({
      where: { acknowledgedAt: null },
      orderBy: { at: "desc" },
    });
    if (latest === null) return null;
    const [batchSum, since, [allTimeTotal, ipTotal]] = await Promise.all([
      db.wafEvent.aggregate({ _sum: { count: true }, where: { eventId: latest.eventId } }),
      (async () => { const s = new Date(); s.setHours(0,0,0,0); return s; })(),
      Promise.all([
        db.wafEvent.count(),
        db.wafEvent.count({ where: { ip: latest.ip } }),
      ]),
    ]);
    const todayTotal = await db.wafEvent.count({ where: { at: { gte: since } } });
    return (
      <KunAlertModalSlot
        data={{
          eventId: latest.eventId,
          at: latest.at.toISOString(),
          ruleId: latest.ruleId,
          action: latest.action,
          ip: latest.ip,
          count: batchSum._sum.count ?? latest.count,
          sample: latest.sample,
          todayTotal,
          allTimeTotal,
          ipTotal,
          severity: latest.action === 'block' ? 'critical' : latest.action === 'challenge' ? 'high' : 'medium',
        }}
      />
    );
  } catch {
    return null;
  }
}
