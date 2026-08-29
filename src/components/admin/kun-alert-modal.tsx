"use client";

/**
 * E1 · Post-login attack-alert modal: surfaces the latest attack details when an unacknowledged WafEvent exists.
 * localStorage stores the last-seen eventId to prevent re-prompting across tabs; "Got it" writes acknowledgedAt.
 */
import { useEffect, useState } from "react";
import { safeLocalStorage } from "@/lib/web-utils";
import { useTranslations } from "next-intl";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ShieldAlert } from "lucide-react";
import { acknowledgeWafEventsAction } from "@/lib/actions/waf";
import { lockAdminAction } from "@/lib/actions/waf-lock";

export interface AlertData {
  eventId: string;
  at: string;
  ruleId: string;
  action: string;
  ip: string;
  count: number;
  sample: string | null;
  todayTotal: number;
  allTimeTotal: number;
  ipTotal: number;
  severity: "low" | "medium" | "high" | "critical";
}

const LS_KEY = "hito_kun_alert_seen";

export function KunAlertModal({ data }: { data: AlertData }) {
  const t = useTranslations();
  const [open, setOpen] = useState(false); // SSR: false; updated in client effect
  const [locking, setLocking] = useState(false);
  const [showLock, setShowLock] = useState(false);
  const [lockMinutes, setLockMinutes] = useState("15");

  useEffect(() => {
    let seen: string | null = null;
    try { seen = safeLocalStorage().getItem(LS_KEY); } catch {}
    if (seen !== data.eventId) setOpen(true);
  }, [data.eventId]);

  function markSeen(): void {
    try { safeLocalStorage().setItem(LS_KEY, data.eventId); } catch {}
    setOpen(false);
  }

  async function ack(): Promise<void> {
    await acknowledgeWafEventsAction(undefined);
    markSeen();
  }

  async function lock(): Promise<void> {
    setLocking(true);
    const r = await lockAdminAction({ minutes: Number(lockMinutes) || 15 });
    setLocking(false);
    if (r.ok) {
      markSeen();
      window.location.href = "/admin/locked";
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && markSeen()}>
      <DialogContent className="sm:max-w-lg" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="size-5 text-destructive" aria-hidden="true" />
            {t("waf.alertTitle")}
          </DialogTitle>
          <DialogDescription>{t("waf.alertSubtitle")}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <span className="text-muted-foreground">{t("waf.time")}</span><span>{data.at.replace("T", " ").slice(0, 19)}</span>
          <span className="text-muted-foreground">{t("waf.rule")}</span><span><code>{data.ruleId}</code></span>
          <span className="text-muted-foreground">{t("waf.actionCol")}</span><span className="flex items-center gap-1.5"><span className={`inline-block size-2 rounded-full ${data.severity === 'critical' ? 'bg-red-500' : data.severity === 'high' ? 'bg-orange-500' : data.severity === 'medium' ? 'bg-yellow-500' : 'bg-green-500'}`} />{data.action} <span className="text-xs text-muted-foreground">({data.severity})</span></span>
          <span className="text-muted-foreground">IP</span><span className="font-mono text-xs">{data.ip}</span>
          <span className="text-muted-foreground">Batch count</span><span>×{data.count.toLocaleString()}</span>
          <span className="text-muted-foreground">IP total</span><span className="font-semibold tabular-nums">{data.ipTotal.toLocaleString()}</span>
          <span className="col-span-2 mt-1 border-t border-border pt-2 text-muted-foreground">
            <span>{t("waf.todayTotal")}: <strong className="text-foreground">{data.todayTotal.toLocaleString()}</strong></span>
            <span className="ml-4">Lifetime: <strong className="text-foreground">{data.allTimeTotal.toLocaleString()}</strong></span>
          </span>
        </div>
        {data.sample && (
          <pre className="max-h-28 overflow-auto whitespace-pre-wrap rounded bg-surface-2 p-3 text-xs">{data.sample.slice(0, 200)}</pre>
        )}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <input type="radio" id="kun-ack-only" name="kun-dispose" defaultChecked
              onChange={() => setShowLock(false)} />
            <Label htmlFor="kun-ack-only">{t("waf.disposeAckOnly")}</Label>
          </div>
          <div className="flex items-start gap-2">
            <input type="radio" id="kun-lock" name="kun-dispose"
              onChange={() => setShowLock(true)} />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="kun-lock">{t("waf.disposeLock")}</Label>
              {showLock && (
                <div className="flex items-center gap-2">
                  <Select defaultValue="15" onValueChange={setLockMinutes}>
                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[15, 60, 360, 1440].map((m) => (
                        <SelectItem key={m} value={String(m)}>
                          {m >= 60 ? `${m / 60} h` : `${m} min`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input inputMode="numeric" placeholder={t("waf.customMinutes")} className="w-28"
                    value={lockMinutes} onChange={(e) => setLockMinutes(e.target.value)} />
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => void ack()} disabled={locking}>
            {t("waf.gotIt")}
          </Button>
          <Button variant="destructive" onClick={() => void lock()} disabled={locking || !showLock}>
            {locking ? t("common.saving") : t("waf.confirmAndDispose")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
