import type { Metadata } from "next";
import { MousePointerClick, SquareStack } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { TrendChart, type TrendPoint } from "@/components/admin/trend-chart";
import { getDb } from "@/lib/db";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.nav");
  return { title: t("dashboard") };
}

export const dynamic = "force-dynamic";

/** Last 30 days aggregated daily; SQLite strftime for grouping, app-side zero-fills missing days. */
async function getTrend(): Promise<TrendPoint[]> {
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - 29);

  const rows = await getDb().$queryRaw<Array<{ day: string; total: number }>>`
    SELECT strftime('%Y-%m-%d', createdAt / 1000, 'unixepoch', 'localtime') AS day, COUNT(*) AS total
    FROM click_events
    WHERE createdAt >= ${since}
    GROUP BY day
    ORDER BY day ASC
  `;
  const byDay = new Map(rows.map((row) => [row.day, Number(row.total)]));

  const points: TrendPoint[] = [];
  for (let offset = 0; offset < 30; offset++) {
    const date = new Date(since);
    date.setDate(since.getDate() + offset);
    const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    points.push({ day, count: byDay.get(day) ?? 0 });
  }
  return points;
}

export default async function DashboardPage() {
  const db = getDb();
  const [t, format, totalCards, published, drafts, clicksAgg, topCards, recentAudit, trend] =
    await Promise.all([
      getTranslations(),
      getFormatter(),
      db.card.count({ where: { deletedAt: null } }),
      db.card.count({ where: { deletedAt: null, status: "PUBLISHED" } }),
      db.card.count({ where: { deletedAt: null, status: "DRAFT" } }),
      db.card.aggregate({ _sum: { clickCount: true }, where: { deletedAt: null } }),
      db.card.findMany({
        where: { deletedAt: null },
        orderBy: { clickCount: "desc" },
        take: 8,
        select: { id: true, title: true, clickCount: true, url: true },
      }),
      db.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        select: { id: true, username: true, action: true, createdAt: true },
      }),
      getTrend(),
    ]);

  const totalClicks = clicksAgg._sum.clickCount ?? 0;
  const hasTrendData = trend.some((point) => point.count > 0);

  const stats = [
    { label: t("admin.dashboard.totalCards"), value: totalCards },
    { label: t("admin.dashboard.published"), value: published },
    { label: t("admin.dashboard.drafts"), value: drafts },
    { label: t("admin.dashboard.totalClicks"), value: totalClicks },
  ];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("admin.nav.dashboard")}</h1>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-card border border-border bg-card p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-faint">
              {stat.label}
            </p>
            <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight">
              {format.number(stat.value)}
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-card border border-border bg-card p-5">
        <h2 className="text-sm font-semibold">{t("admin.dashboard.trend")}</h2>
        <div className="mt-4">
          {hasTrendData ? (
            <TrendChart points={trend} />
          ) : (
            <p className="py-10 text-center text-sm text-faint">
              {t("admin.dashboard.noData")}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-card border border-border bg-card p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <MousePointerClick className="size-4 text-faint" aria-hidden="true" />
            {t("admin.dashboard.topCards")}
          </h2>
          {topCards.length === 0 ? (
            <p className="py-10 text-center text-sm text-faint">
              {t("admin.dashboard.noData")}
            </p>
          ) : (
            <ol className="mt-3 flex flex-col">
              {topCards.map((card, index) => (
                <li
                  key={card.id}
                  className="flex items-center gap-3 border-b border-border py-2.5 text-sm last:border-0"
                >
                  <span className="w-5 shrink-0 text-right text-xs tabular-nums text-faint">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{card.title}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {format.number(card.clickCount)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="rounded-card border border-border bg-card p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <SquareStack className="size-4 text-faint" aria-hidden="true" />
            {t("admin.dashboard.recentActivity")}
          </h2>
          {recentAudit.length === 0 ? (
            <p className="py-10 text-center text-sm text-faint">
              {t("admin.dashboard.noData")}
            </p>
          ) : (
            <ul className="mt-3 flex flex-col">
              {recentAudit.map((entry) => (
                <li
                  key={String(entry.id)}
                  className="flex items-center gap-3 border-b border-border py-2.5 text-sm last:border-0"
                >
                  <code className="shrink-0 rounded bg-surface-2 px-1.5 py-0.5 text-xs text-muted-foreground">
                    {entry.action}
                  </code>
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">
                    {entry.username}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-faint">
                    {format.dateTime(entry.createdAt, {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
