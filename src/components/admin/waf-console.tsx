"use client";

import { useEffect, useState } from "react";
import { Activity, Ban, BarChart3, Loader2, RefreshCw, ShieldAlert, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { AttackCountryRank, AttackLiveFeed, WorldAttackMap } from "@/components/admin/world-attack-map";
import { PROBE_PREFIXES, PROBE_SUFFIXES } from "@/lib/security/engine/rules";
import { toggleWafRuleAction } from "@/lib/actions/waf";
import type { WafEventItem, KunBanEntryView, SessionItem } from "./types";
import { manualUnderAttackAction, releaseKunBansAction, saveWafRuntimeConfigAction, stopManualUnderAttackAction } from "@/lib/actions/waf";



interface TrendPoint { day: string; count: number }
interface DistItem { ruleId: string; action: string; total: number }
interface TopIp { ip: string; total: number }
interface RuleRow { name: string; limit: number; windowSeconds: number }
export interface MapMarker { cc: string; total: number; lastAt: string; lng: number; lat: number; size: number; topAction: string }
export interface RecentHit { id: number; at: string; ip: string; ruleId: string; action: string; cc: string | null }

interface WafConsoleProps {
  trend: TrendPoint[];
  distribution: DistItem[];
  topIps: TopIp[];
  todayTotal: number;
  events: WafEventItem[];
  eventTotal: number;
  eventPage: number;
  eventPageSize: number;
  filters: { ruleId: string; action: string; ip: string };
  kunBans: KunBanEntryView[];
  manualAttackUntil: string | null;
  telemetryQps: number | null;
  audit: import("./types").AuditLogItem[];
  sessions: SessionItem[];
  ipBans: import("./types").IpBanItem[];
  rules: RuleRow[];
  mapData: MapMarker[];
  recentHits: RecentHit[];
  serverLng: number;
  serverLat: number;
}

type Tab = "overview" | "logs" | "rules" | "bans" | "basics";

const AUTO_REFRESH_MS = 15000;

export function WafConsole(props: WafConsoleProps) {
  const t = useTranslations();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Auto refresh keeps the map / feed live; pause when tab hidden or off overview
  useEffect(() => {
    if (!autoRefresh || tab !== "overview") return;
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
    const timer = setInterval(() => router.refresh(), AUTO_REFRESH_MS);
    return () => clearInterval(timer);
  }, [autoRefresh, tab, router]);

  const tabs: Array<{ id: Tab; label: string; icon: typeof Activity }> = [
    { id: "overview", label: t("waf.tabOverview"), icon: BarChart3 },
    { id: "logs", label: t("waf.tabLogs"), icon: ShieldAlert },
    { id: "rules", label: t("waf.tabRules"), icon: ShieldCheck },
    { id: "bans", label: t("waf.tabBans"), icon: Ban },
    { id: "basics", label: t("waf.tabBasics"), icon: ShieldCheck },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <ShieldCheck className="size-6" aria-hidden="true" />
          {t("waf.title")}
          <Badge variant="outline" className="ml-1 font-mono">Kun 1.0</Badge>
        </h1>
        <LiveQps qps={props.telemetryQps} attackUntil={props.manualAttackUntil} />
      </div>

      <div className="flex flex-wrap gap-2" role="tablist">
        {tabs.map(({ id, label, icon: Icon }) => (
          <Button
            key={id}
            variant={tab === id ? "default" : "outline"}
            size="sm"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
          >
            <Icon className="size-4" aria-hidden="true" />
            {label}
          </Button>
        ))}
      </div>

      {tab === "overview" && (
        <OverviewTab {...props} autoRefresh={autoRefresh} onAutoRefreshChange={setAutoRefresh} />
      )}
      {tab === "logs" && (
        <LogsTab events={props.events} total={props.eventTotal}
          page={props.eventPage} pageSize={props.eventPageSize}
          filters={props.filters} />
      )}
      {tab === "rules" && (
        <RulesAndParams />
      )}
      {tab === "bans" && (
        <BansTab kunBans={props.kunBans} ipBans={props.ipBans as never[]} />
      )}
      {tab === "basics" && <BasicsSlot />}
    </div>
  );

  function OverviewTab(p: WafConsoleProps & { autoRefresh: boolean; onAutoRefreshChange: (v: boolean) => void }) {
    const maxTrend = Math.max(1, ...p.trend.map((x) => x.count));
    const maxDist = Math.max(1, ...p.distribution.map((x) => x.total));
    return (
      <div className="flex flex-col gap-4">
        <section className="rounded-card border border-border bg-card p-2">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-3 pt-1">
            <h2 className="text-sm font-semibold">{t("waf.mapTitle")}</h2>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <RefreshCw className="size-3" aria-hidden="true" />
              {t("waf.mapAutoRefresh")}
              <Switch checked={p.autoRefresh} onCheckedChange={p.onAutoRefreshChange} aria-label={t("waf.mapAutoRefresh")} />
            </label>
          </div>
          <div className="grid grid-cols-1 gap-3 px-2 pb-2 xl:grid-cols-[1fr_minmax(240px,300px)]">
            <WorldAttackMap
              markers={p.mapData}
              recent={p.recentHits}
              serverLng={p.serverLng}
              serverLat={p.serverLat}
            />
            <div className="flex flex-col gap-3">
              <div className="rounded-card border border-border bg-surface p-3">
                <h3 className="mb-2 text-xs font-semibold text-muted-foreground">{t("waf.mapLiveFeed")}</h3>
                <AttackLiveFeed recent={p.recentHits.slice(0, 9)} />
              </div>
              <div className="rounded-card border border-border bg-surface p-3">
                <h3 className="mb-2 text-xs font-semibold text-muted-foreground">{t("waf.mapTopCountries")}</h3>
                <AttackCountryRank markers={p.mapData} max={6} />
              </div>
            </div>
          </div>
        </section>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <section className="rounded-card border border-border bg-card p-5 xl:col-span-2">
            <h2 className="mb-3 text-sm font-semibold">{t("waf.trend7d")}</h2>
            <div className="flex h-40 items-end gap-2" aria-hidden="true">
              {p.trend.map((pt) => (
                <div key={pt.day} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                  <div
                    className="w-full rounded-t bg-accent-gradient transition-all"
                    style={{ height: `max(2px, calc(${((pt.count / maxTrend) * 100).toFixed(1)}% - 16px))` }}
                    title={`${pt.day}: ${pt.count}`}
                  />
                  <span className="text-[10px] text-faint">{pt.day.slice(5)}</span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-faint">{t("waf.todayTotal")}: <strong>{p.todayTotal}</strong></p>
          </section>
          <section className="rounded-card border border-border bg-card p-5">
            <h2 className="mb-3 text-sm font-semibold">{t("waf.dist24h")}</h2>
            {p.distribution.length === 0 ? (
              <EmptyLine />
            ) : (
              <div className="flex flex-col gap-2.5">
                {p.distribution.map((d) => (
                  <div key={`${d.ruleId}-${d.action}`} className="flex items-center gap-2">
                    <span className="w-24 shrink-0 truncate font-mono text-xs">{d.ruleId}</span>
                    <div className="h-3 flex-1 overflow-hidden rounded-full bg-surface-2">
                      <div className="h-full rounded-full bg-accent-gradient"
                        style={{ width: `${Math.max(3, (d.total / maxDist) * 100)}%` }} />
                    </div>
                    <span className="w-10 shrink-0 text-right text-xs tabular-nums">{d.total}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
          <section className="rounded-card border border-border bg-card p-5">
            <h2 className="mb-3 text-sm font-semibold">{t("waf.topIps")}</h2>
            {p.topIps.length === 0 ? <EmptyLine /> : (
              <ol className="flex flex-col">
                {p.topIps.map((row, i) => (
                  <li key={row.ip} className="flex items-center gap-3 border-b border-border py-2 text-sm last:border-0">
                    <span className="w-5 text-right text-xs tabular-nums text-faint">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate font-mono text-xs">{row.ip}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">{row.total}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </div>
    );
  }

  function LogsTab(p: { events: WafEventItem[]; total: number; page: number; pageSize: number; filters: { ruleId: string; action: string; ip: string } }) {
    const [detail, setDetail] = useState<WafEventItem | null>(null);
    const totalPages = Math.max(1, Math.ceil(p.total / p.pageSize));
    return (
      <div className="flex flex-col gap-3">
        <form className="flex flex-wrap items-end gap-2" method="get">
          <Input name="rule" defaultValue={p.filters.ruleId} placeholder={t("waf.fRule")} className="w-36" />
          <Select name="wafAction" defaultValue={p.filters.action || "all"}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("common.all")}</SelectItem>
              {["log", "block", "challenge", "ban"].map((a) => (
                <SelectItem key={a} value={a}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input name="ip" defaultValue={p.filters.ip} placeholder={t("waf.fIp")} className="w-40" />
          <Button variant="outline" size="sm" type="submit">{t("common.search")}</Button>
        </form>

        <WafTable events={p.events} onDetail={setDetail} />

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{t("waf.pageOf", { page: p.page, total: totalPages })}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={p.page <= 1}
              onClick={() => router.push(`?page=${p.page - 1}`)}>{t("common.back")}</Button>
            <Button variant="outline" size="sm" disabled={p.page >= totalPages}
              onClick={() => router.push(`?page=${p.page + 1}`)}>{t("common.next")}</Button>
          </div>
        </div>

        <Dialog open={detail !== null} onOpenChange={(o) => !o && setDetail(null)}>
          <DialogContent aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle>{detail?.ruleId} · {detail?.action}</DialogTitle>
            </DialogHeader>
            {detail && (
              <div className="flex flex-col gap-2 text-sm">
                <p><strong>{t("waf.at")}:</strong> {detail.at}</p>
                <p><strong>IP:</strong> <code>{detail.ip}</code></p>
                <p><strong>URI:</strong> <code className="break-all">{detail.path}</code></p>
                <p><strong>UA:</strong> <span className="break-all text-muted-foreground">{detail.ua}</span></p>
                <p><strong>count:</strong> {detail.count}</p>
                {detail.sample && (
                  <>
                    <Label>{t("waf.sample")}</Label>
                    <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded bg-surface-2 p-3 text-xs">{detail.sample}</pre>
                    <p className="text-xs text-faint">{t("waf.sampleNote")}</p>
                  </>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    );
  }



  function BansTab({ kunBans, ipBans }: { kunBans: KunBanEntryView[]; ipBans: import("./types").IpBanItem[] }) {
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [busy, setBusy] = useState(false);

    async function releaseSelected(): Promise<void> {
      if (selected.size === 0) return;
      setBusy(true);
      const r = await releaseKunBansAction({ ipKeys: Array.from(selected) });
      setBusy(false);
      if (r.ok) { toast.success(t("common.done")); setSelected(new Set()); router.refresh(); }
      else toast.error(t("errors.generic"));
    }

    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-card border border-border bg-card p-5">
          <h2 className="mb-1 text-sm font-semibold">{t("waf.kunBans")}</h2>
          <p className="mb-3 text-xs text-faint">{t("waf.kunBansHint")}</p>
          {kunBans.length === 0 ? <EmptyLine /> : (
            <>
              <div className="mb-2 flex justify-end">
                <Button size="sm" variant="outline" disabled={busy || selected.size === 0}
                  onClick={() => void releaseSelected()}>
                  {busy && <Loader2 className="size-4 animate-spin" />}
                  {t("waf.releaseSelected")}
                </Button>
              </div>
              <ul className="flex flex-col divide-y divide-border">
                {kunBans.map((entry) => (
                  <li key={entry.ipKey} className="flex items-center gap-2 py-2 text-sm">
                    <input type="checkbox" checked={selected.has(entry.ipKey)}
                      onChange={(e) => {
                        const next = new Set(selected);
                        if (e.target.checked) next.add(entry.ipKey); else next.delete(entry.ipKey);
                        setSelected(next);
                      }} />
                    <code className="flex-1 truncate font-mono text-xs">{entry.ipKey}</code>
                    <Badge variant="destructive">
                      {new Date(entry.bannedUntil).toLocaleTimeString()}
                    </Badge>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section className="rounded-card border border-border bg-card p-5">
          <h2 className="mb-1 text-sm font-semibold">{t("waf.manualBans")}</h2>
          <p className="mb-3 text-xs text-faint">{t("waf.manualBansHint")}</p>
          {ipBans.length === 0 ? <EmptyLine /> : (
            <ul className="flex flex-col divide-y divide-border">
              {(ipBans as unknown as Array<{ ip: string; reason: string | null; expiresAt: string | null }>).map((ban) => (
                <li key={ban.ip} className="py-2 text-sm">
                  <code className="font-mono text-xs">{ban.ip}</code>
                  {ban.reason && <span className="ml-2 text-faint">{ban.reason}</span>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    );
  }

  function BasicsSlot() {
    return null;
  }
}

function EmptyLine() {
  return <p className="py-8 text-center text-sm text-faint">—</p>;
}

function WafTable({ events, onDetail }: {
  events: WafEventItem[];
  onDetail: (e: WafEventItem) => void;
}) {
  const t = useTranslations();
  if (events.length === 0) return <EmptyLine />;
  return (
    <div className="overflow-x-auto rounded-card border border-border">
      <table className="w-full text-sm">
        <thead className="bg-surface-2 text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-3 py-2">{t("waf.time")}</th>
            <th className="px-3 py-2">IP</th>
            <th className="px-3 py-2">{t("waf.rule")}</th>
            <th className="px-3 py-2">{t("waf.actionCol")}</th>
            <th className="px-3 py-2">URI</th>
            <th className="px-3 py-2 text-right">count</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {events.map((ev) => (
            <tr key={ev.id} className="border-t border-border hover:bg-surface-2/50 cursor-pointer"
              onClick={() => onDetail(ev)}>
              <td className="px-3 py-2 whitespace-nowrap text-xs tabular-nums">{ev.at.replace("T", " ").slice(0, 19)}</td>
              <td className="px-3 py-2 font-mono text-xs">{ev.ip}</td>
              <td className="px-3 py-2"><Badge variant="outline">{ev.ruleId}</Badge></td>
              <td className="px-3 py-2">
                <Badge variant={ev.action === "block" ? "destructive" : ev.action === "ban" ? "outline" : "default"}>
                  {ev.action}
                </Badge>
              </td>
              <td className="max-w-56 truncate px-3 py-2 font-mono text-xs">{ev.path}</td>
              <td className="px-3 py-2 text-right tabular-nums">{ev.count > 1 ? `×${ev.count}` : 1}</td>
              <td className="px-2 py-2 text-right text-xs text-faint">›</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RulesAndParams() {
  const t = useTranslations();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [qps, setQps] = useState("600");
  const [ttl, setTtl] = useState("600");
  const [win, setWin] = useState("300");
  const [mode, setMode] = useState<"off" | "log" | "block">("log");
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [manualMinutes, setManualMinutes] = useState("");
  const [manualOpen, setManualOpen] = useState(false);

  async function save(nextMode?: "off" | "log" | "block"): Promise<void> {
    setSaving(true);
    const result = await saveWafRuntimeConfigAction({
      mode: nextMode ?? mode,
      underAttackQps: Number(qps),
      challengeTtl: Number(ttl),
      windowLimit: Number(win),
    });
    setSaving(false);
    if (result.ok) { toast.success(t("common.saved")); router.refresh(); }
    else toast.error(t("errors.generic"));
  }

  async function startManual(): Promise<void> {
    const minutes = Number(manualMinutes) || 15;
    setManualOpen(false);
    const result = await manualUnderAttackAction({ minutes });
    if (result.ok) { toast.success(t("common.saved")); router.refresh(); }
    else toast.error(t("errors.generic"));
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <section className="rounded-card border border-border bg-card p-5">
        <h2 className="mb-4 text-sm font-semibold">{t("waf.modeSwitch")}</h2>
        <div className="flex flex-wrap gap-2">
          {(["off", "log", "block"] as const).map((m) => (
            <Button key={m} variant={mode === m ? "default" : "outline"} size="sm"
              onClick={() => { if (m === "block") { setConfirmBlock(true); } else { setMode(m); void save(m); } }}>
              {m}
            </Button>
          ))}
        </div>
        <p className="mt-2 text-xs text-faint">{t("waf.modeHint")}</p>
        <hr className="my-4 border-border" />
        <div className="flex flex-wrap items-end gap-2">
          <Button size="sm" variant="destructive" onClick={() => { setManualMinutes("15"); setManualOpen(true); }}>
            {t("waf.manualAttack")}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void stopManualUnderAttackAction().then(() => router.refresh())}>
            {t("waf.stopManual")}
          </Button>
        </div>
        <AlertDialog open={confirmBlock} onOpenChange={setConfirmBlock}>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>{t("waf.blockConfirmTitle")}</AlertDialogTitle></AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
              <AlertDialogAction onClick={() => { setMode("block"); setConfirmBlock(false); void save("block"); }}>
                {t("common.confirm")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <Dialog open={manualOpen} onOpenChange={setManualOpen}>
          <DialogContent className="sm:max-w-sm" aria-describedby={undefined}>
            <DialogHeader><DialogTitle>{t("waf.manualAttackDuration")}</DialogTitle></DialogHeader>
            <Input inputMode="numeric" value={manualMinutes} onChange={(e) => setManualMinutes(e.target.value)} />
            <div className="flex justify-end gap-2">
              {[15, 60].map((m) => (
                <Button key={m} size="sm" variant="outline" onClick={() => setManualMinutes(String(m))}>{m}m</Button>
              ))}
              <Button size="sm" variant="gradient" onClick={() => void startManual()}>{t("common.confirm")}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </section>

      <section className="rounded-card border border-border bg-card p-5">
        <h2 className="mb-4 text-sm font-semibold">{t("waf.ccParams")}</h2>
        <form className="grid grid-cols-1 gap-3 sm:grid-cols-3"
          onSubmit={(e) => { e.preventDefault(); void save(); }}>
          <FormField id="qps" label="UNDER_ATTACK_QPS" value={qps} onChange={setQps} />
          <FormField id="ttl" label="CHALLENGE_TTL" value={ttl} onChange={setTtl} />
          <FormField id="win" label="WINDOW_LIMIT" value={win} onChange={setWin} />
          <div className="sm:col-span-3 flex justify-end">
            <Button type="submit" size="sm" variant="gradient" disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />} {t("common.save")}
            </Button>
          </div>
        </form>
        <p className="mt-1 text-xs text-faint">{t("waf.hotReloadHint")}</p>
      </section>

      <section className="rounded-card border border-border bg-card p-5 xl:col-span-2">
        <h2 className="mb-3 text-sm font-semibold">{t("waf.l2Rules")}</h2>
        <L2RuleList />
      </section>
    </div>
  );
}

function FormField({ id, label, value, onChange }: {
  id: string; label: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`cc-${id}`} className="font-mono text-xs">{label}</Label>
      <Input id={`cc-${id}`} inputMode="numeric" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function L2RuleList() {
  const t = useTranslations();
  const router = useRouter();
  const [disabledSet, setDisabledSet] = useState<Set<string>>(new Set());
  const entries = [
    ...PROBE_PREFIXES.map((p) => ({ entry: `prefix:${p}`, label: p })),
    ...PROBE_SUFFIXES.map((s) => ({ entry: `suffix:${s}`, label: s })),
  ];
  async function toggle(entry: string, disabled: boolean): Promise<void> {
    const r = await toggleWafRuleAction({ entry, disabled });
    if (r.ok) {
      const next = new Set(disabledSet);
      if (disabled) next.add(entry); else next.delete(entry);
      setDisabledSet(next);
      router.refresh();
    } else toast.error(t("errors.generic"));
  }
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 sm:grid-cols-3 lg:grid-cols-4">
      {entries.map(({ entry, label }) => {
        const isDisabled = disabledSet.has(entry);
        return (
          <label key={entry} className="flex items-center gap-2 text-xs">
            <Switch checked={!isDisabled} onCheckedChange={(c) => void toggle(entry, !c)} />
            <code className="truncate font-mono">{label}</code>
          </label>
        );
      })}
    </div>
  );
}

function LiveQps({ qps, attackUntil }: { qps: number | null; attackUntil: string | null }) {
  const remainingMs = attackUntil !== null ? new Date(attackUntil).getTime() - Date.now() : 0;
  const underAttack = remainingMs > 0;
  return (
    <div className="flex items-center gap-2">
      {underAttack && (
        <Badge variant="destructive">under attack &middot; {Math.ceil(remainingMs / 1000)}s</Badge>
      )}
      <Badge variant={qps !== null && qps > 400 ? "destructive" : "default"}>QPS {qps ?? "—"}</Badge>
    </div>
  );
}