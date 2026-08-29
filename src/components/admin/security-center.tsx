"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { FileDown, Loader2, ShieldBan } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FieldError } from "@/components/setup/field-error";
import { banIpAction, exportAuditCsvAction, revokeOtherSessionsAction, revokeSessionAction, unbanIpAction } from "@/lib/actions/security";
import { banIpFormSchema, type BanIpFormInput } from "@/lib/validators/content";
import type { AuditLogItem, IpBanItem, SessionItem } from "./types";
import { downloadText, errorKeyFor } from "./utils";

interface RateRuleRow { name: string; limit: number; windowSeconds: number }

export function SecurityCenter({ audit, auditTotal, auditPage, auditPageSize, actionFilter, userFilter, sessions, bans, rules }: {
  audit: AuditLogItem[]; auditTotal: number; auditPage: number; auditPageSize: number;
  actionFilter: string; userFilter: string; sessions: SessionItem[]; bans: IpBanItem[]; rules: RateRuleRow[];
}) {
  const t = useTranslations();
  const format = useFormatter();
  const router = useRouter();
  const pathname = usePathname();
  const [busy, setBusy] = useState(false);
  const [actionInput, setActionInput] = useState(actionFilter);
  const [userInput, setUserInput] = useState(userFilter);

  const totalPages = Math.max(1, Math.ceil(auditTotal / auditPageSize));

  const applyAuditFilter = (page: number) => {
    const query = new URLSearchParams();
    if (actionInput.trim()) query.set("action", actionInput.trim());
    if (userInput.trim()) query.set("user", userInput.trim());
    if (page > 1) query.set("page", String(page));
    router.push(`${pathname}?${query}`);
  };

  const run = async (action: () => Promise<{ ok: boolean; code?: string }>) => {
    setBusy(true);
    const outcome = await action();
    setBusy(false);
    if (outcome.ok) { toast.success(t("common.done")); router.refresh(); }
    else toast.error(t(errorKeyFor(outcome.code ?? "generic")));
  };

  const exportAudit = async () => {
    setBusy(true);
    const outcome = await exportAuditCsvAction({ action: actionInput.trim(), username: userInput.trim() });
    setBusy(false);
    if (!outcome.ok) { toast.error(t(errorKeyFor(outcome.code))); return; }
    downloadText("audit-log.csv", outcome.data.content, "text/csv;charset=utf-8");
  };

  const fmtTime = (iso: string) => format.dateTime(new Date(iso), { dateStyle: "short", timeStyle: "short" });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">{t("admin.nav.security")}</h1>

      <Tabs defaultValue="audit">
        <TabsList>
          <TabsTrigger value="audit">{t("admin.security.audit")}</TabsTrigger>
          <TabsTrigger value="sessions">{t("admin.security.sessions")}</TabsTrigger>
          <TabsTrigger value="bans">{t("admin.security.ipBans")}</TabsTrigger>
          <TabsTrigger value="rules">{t("admin.security.rateRules")}</TabsTrigger>
        </TabsList>

        <TabsContent value="audit" className="flex flex-col gap-3">
          <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); applyAuditFilter(1); }}>
            <Input value={actionInput} onChange={(e) => setActionInput(e.target.value)} placeholder={t("admin.security.action")} className="w-44" aria-label={t("admin.security.action")} />
            <Input value={userInput} onChange={(e) => setUserInput(e.target.value)} placeholder={t("common.username")} className="w-44" aria-label={t("common.username")} />
            <Button type="submit" variant="secondary" disabled={busy}>{t("common.search")}</Button>
            <Button type="button" variant="outline" disabled={busy} onClick={() => void exportAudit()} className="ms-auto">
              <FileDown className="size-4" aria-hidden="true" />{t("admin.security.exportCsv")}
            </Button>
          </form>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("admin.security.time")}</TableHead>
                <TableHead>{t("common.username")}</TableHead>
                <TableHead>{t("admin.security.action")}</TableHead>
                <TableHead>{t("admin.security.target")}</TableHead>
                <TableHead>{t("admin.security.ip")}</TableHead>
                <TableHead>{t("admin.security.userAgent")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {audit.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="py-10 text-center text-faint">{t("admin.table.empty")}</TableCell></TableRow>
              ) : audit.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="whitespace-nowrap text-xs tabular-nums text-faint">{fmtTime(e.createdAt)}</TableCell>
                  <TableCell className="font-medium">{e.username}</TableCell>
                  <TableCell><code className="rounded bg-surface-2 px-1.5 py-0.5 text-xs">{e.action}</code></TableCell>
                  <TableCell className="max-w-40 truncate text-xs text-muted-foreground">{e.targetType}{e.targetId !== null ? ` · ${e.targetId}` : ""}</TableCell>
                  <TableCell className="text-xs tabular-nums text-muted-foreground">{e.ip}</TableCell>
                  <TableCell className="max-w-48 truncate text-xs text-faint">{e.userAgent}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex items-center justify-end gap-2 text-sm text-faint">
            <Button variant="outline" size="sm" disabled={auditPage <= 1} onClick={() => applyAuditFilter(auditPage - 1)}>{t("common.back")}</Button>
            <span className="tabular-nums">{auditPage} / {totalPages}</span>
            <Button variant="outline" size="sm" disabled={auditPage >= totalPages} onClick={() => applyAuditFilter(auditPage + 1)}>{t("common.next")}</Button>
          </div>
        </TabsContent>

        <TabsContent value="sessions" className="flex flex-col gap-3">
          <div className="flex justify-end">
            <Button variant="outline" disabled={busy} onClick={() => void run(() => revokeOtherSessionsAction())}>{t("admin.security.revokeAll")}</Button>
          </div>
          <ul className="flex flex-col gap-2">
            {sessions.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 rounded-card border border-border bg-card px-4 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{s.username}{s.isCurrent && <Badge variant="success" className="ms-2">{t("admin.security.current")}</Badge>}</p>
                  <p className="mt-0.5 truncate text-xs text-faint">{s.ip} · {s.userAgent}</p>
                  <p className="text-xs tabular-nums text-faint">{t("admin.security.time")}: {fmtTime(s.lastUsedAt)}</p>
                </div>
                {!s.isCurrent && (
                  <Button variant="outline" size="sm" disabled={busy} onClick={() => void run(() => revokeSessionAction(s.id))}>{t("admin.security.revoke")}</Button>
                )}
              </li>
            ))}
          </ul>
        </TabsContent>

        <TabsContent value="bans" className="flex flex-col gap-4">
          <BanIpForm busy={busy} onSubmit={(v) => void run(() => banIpAction(v))} />
          {bans.length === 0 ? (
            <p className="py-8 text-center text-sm text-faint">{t("admin.table.empty")}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {bans.map((ban) => (
                <li key={ban.id} className="flex flex-wrap items-center gap-3 rounded-card border border-border bg-card px-4 py-3 text-sm">
                  <ShieldBan className="size-4 shrink-0 text-destructive" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium tabular-nums">{ban.ip}</p>
                    <p className="mt-0.5 text-xs text-faint">{ban.reason ?? "—"} · {ban.createdBy} · {t("admin.security.expires")}: {ban.expiresAt === null ? t("admin.security.never") : fmtTime(ban.expiresAt)}</p>
                  </div>
                  <Button variant="outline" size="sm" disabled={busy} onClick={() => void run(() => unbanIpAction(ban.id))}>{t("admin.security.unban")}</Button>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="rules">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("common.name")}</TableHead>
                <TableHead className="text-right">{t("admin.security.rateRules")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => (
                <TableRow key={rule.name}>
                  <TableCell><code className="rounded bg-surface-2 px-1.5 py-0.5 text-xs">{rule.name}</code></TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{rule.limit} / {rule.windowSeconds}s</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function BanIpForm({ busy, onSubmit }: { busy: boolean; onSubmit: (v: BanIpFormInput) => void }) {
  const t = useTranslations();
  const form = useForm<BanIpFormInput>({ resolver: zodResolver(banIpFormSchema((k, v) => t(k, v))), defaultValues: { ip: "", reason: "", expiresDays: "" } });

  return (
    <form className="flex flex-wrap items-end gap-3 rounded-card border border-border bg-surface px-4 py-3"
      onSubmit={(e) => void form.handleSubmit((v) => { onSubmit(v); form.reset(); })(e)}>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ban-ip">{t("admin.security.ip")}</Label>
        <Input id="ban-ip" placeholder="203.0.113.7" className="w-40" {...form.register("ip")} />
        <FieldError message={form.formState.errors.ip?.message} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ban-reason">{t("admin.security.reason")}</Label>
        <Input id="ban-reason" className="w-48" {...form.register("reason")} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ban-days">{t("admin.security.expires")} ({t("common.optional")})</Label>
        <Input id="ban-days" inputMode="numeric" placeholder="30" className="w-24" {...form.register("expiresDays")} />
        <FieldError message={form.formState.errors.expiresDays?.message} />
      </div>
      <Button type="submit" variant="destructive" disabled={busy}>
        {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}{t("admin.security.banIp")}
      </Button>
    </form>
  );
}
