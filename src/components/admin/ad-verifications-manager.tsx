"use client";

import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { FileCheck2, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/shared/empty-state";
import { deleteAdVerificationAction, saveAdVerificationAction, toggleAdVerificationAction } from "@/lib/actions/ads";
import { CUSTOM_PROVIDER_SENTINEL, PRESET_AD_PROVIDERS, adVerificationFormSchema, type AdVerificationFormInput } from "@/lib/validators/ads";
import type { AdminAdVerificationItem } from "./types";
import { errorKeyFor } from "./utils";

const DNS_TYPES = ["TXT", "CNAME", "MX"] as const;
// Radix Select rejects empty-string values; sentinel for "not set"
const DNS_NONE = "__none__";

function FormField({ id, label, error, ...inputProps }: {
  id: string; label: string; error?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} {...inputProps} />
      <p className="text-xs text-destructive">{error ?? ""}</p>
    </div>
  );
}

export function AdVerificationsManager({ items }: { items: AdminAdVerificationItem[] }) {
  const t = useTranslations();
  const router = useRouter();

  const [editing, setEditing] = useState<AdminAdVerificationItem | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<AdminAdVerificationItem | null>(null);
  const [busy, setBusy] = useState(false);

  const badges = (item: AdminAdVerificationItem) => {
    const list: Array<"meta" | "file" | "dns"> = [];
    if (item.metaName !== null && item.metaContent !== null) list.push("meta");
    if (item.fileName !== null && item.fileContent !== null) list.push("file");
    if (item.dnsValue !== null && item.dnsValue !== "") list.push("dns");
    return list;
  };

  const toggle = async (item: AdminAdVerificationItem, next: boolean) => {
    setBusy(true);
    const outcome = await toggleAdVerificationAction(item.id, next);
    setBusy(false);
    if (outcome.ok) router.refresh();
    else toast.error(t(errorKeyFor(outcome.code)));
  };

  const confirmDelete = async () => {
    const target = deleting;
    setDeleting(null);
    if (!target) return;
    setBusy(true);
    const outcome = await deleteAdVerificationAction(target.id);
    setBusy(false);
    if (outcome.ok) { toast.success(t("common.done")); router.refresh(); }
    else toast.error(t(errorKeyFor(outcome.code)));
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("admin.nav.adVerify")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("adver.subtitle")}</p>
        </div>
        <Button variant="gradient" onClick={() => { setEditing(null); setFormOpen(true); }}>
          <Plus className="size-4" aria-hidden="true" />{t("adver.new")}
        </Button>
      </div>

      {items.length === 0 ? (
        <EmptyState icon={FileCheck2} title={t("adver.emptyTitle")} body={t("adver.emptyBody")} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("ads.provider")}</TableHead>
              <TableHead>{t("adver.method")}</TableHead>
              <TableHead>{t("adver.metaName")} / {t("adver.fileName")}</TableHead>
              <TableHead>{t("common.status")}</TableHead>
              <TableHead>{t("common.enabled")}</TableHead>
              <TableHead className="w-20 text-right">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => {
              const bs = badges(item);
              return (
                <TableRow key={item.id}>
                  <TableCell><p className="font-medium">{item.provider}</p></TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {bs.map((b) => (
                        <Badge key={b} variant={b === "dns" ? "outline" : "default"}>
                          {t(b === "meta" ? "adver.badgeMeta" : b === "file" ? "adver.badgeFile" : "adver.badgeDns")}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-72">
                    <p className="truncate font-mono text-xs text-muted-foreground">
                      {item.metaName !== null ? `name="${item.metaName}"` : ""}
                      {item.fileName !== null ? `/${item.fileName}` : ""}
                      {item.dnsType !== null ? `${item.dnsType} ${item.dnsHost ?? "@"}` : ""}
                    </p>
                    <p className="max-w-72 truncate text-xs text-faint">{item.metaContent ?? item.fileContent?.slice(0, 80) ?? item.dnsNote ?? ""}</p>
                  </TableCell>
                  <TableCell>
                    <Badge variant={item.isActive ? "success" : "muted"}>
                      {t(item.isActive ? "admin.announcements.statusLive" : "admin.announcements.statusDisabled")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Switch checked={item.isActive} disabled={busy} onCheckedChange={(n) => void toggle(item, n)} aria-label={t("common.enabled")} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" aria-label={t("common.edit")} onClick={() => { setEditing(item); setFormOpen(true); }}>
                        <Pencil className="size-4" aria-hidden="true" />
                      </Button>
                      <Button variant="ghost" size="icon" aria-label={t("common.delete")} onClick={() => setDeleting(item)}>
                        <Trash2 className="size-4 text-destructive" aria-hidden="true" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <VerificationFormDialog open={formOpen} item={editing} onClose={() => setFormOpen(false)} onSaved={() => { setFormOpen(false); router.refresh(); }} />

      <AlertDialog open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("common.delete")}</AlertDialogTitle>
            <AlertDialogDescription>{t("admin.trash.confirmPurge")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={() => void confirmDelete()}>
              {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}{t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function VerificationFormDialog({ open, item, onClose, onSaved }: {
  open: boolean; item: AdminAdVerificationItem | null; onClose: () => void; onSaved: () => void;
}) {
  const t = useTranslations();
  const [submitting, setSubmitting] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const schema = useMemo(() => adVerificationFormSchema((k, v) => t(k, v)), [t]);
  const form = useForm<AdVerificationFormInput>({ resolver: zodResolver(schema), defaultValues: emptyValues() });

  function emptyValues(): AdVerificationFormInput {
    return { provider: PRESET_AD_PROVIDERS[0], metaName: "", metaContent: "", fileName: "", fileContent: "", dnsType: "", dnsHost: "", dnsValue: "", dnsNote: "", isActive: true };
  }

  useEffect(() => {
    if (!open) return;
    form.reset(item === null ? emptyValues() : {
      provider: item.provider, metaName: item.metaName ?? "", metaContent: item.metaContent ?? "",
      fileName: item.fileName ?? "", fileContent: item.fileContent ?? "",
      dnsType: (item.dnsType ?? "") as AdVerificationFormInput["dnsType"], dnsHost: item.dnsHost ?? "",
      dnsValue: item.dnsValue ?? "", dnsNote: item.dnsNote ?? "", isActive: item.isActive,
    });
    setErrorKey(null);
  }, [open, item, form]);

  const submit = async (values: AdVerificationFormInput) => {
    setSubmitting(true);
    setErrorKey(null);
    const outcome = await saveAdVerificationAction(item?.id ?? null, values);
    setSubmitting(false);
    if (outcome.ok) { toast.success(t("common.saved")); onSaved(); }
    else setErrorKey(errorKeyFor(outcome.code));
  };

  const providerValue = form.watch("provider");
  const isCustom = providerValue !== "" && !(PRESET_AD_PROVIDERS as readonly string[]).includes(providerValue);

  return (
    <Dialog open={open} onOpenChange={(n) => !n && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>{item === null ? t("adver.new") : t("common.edit")}</DialogTitle></DialogHeader>
        <form className="flex flex-col gap-5" onSubmit={(e) => void form.handleSubmit(submit)(e)}>
          <div className="flex flex-col gap-1.5">
            <Label>{t("ads.provider")}</Label>
            <Select value={isCustom ? CUSTOM_PROVIDER_SENTINEL : providerValue}
              onValueChange={(v) => form.setValue("provider", v === CUSTOM_PROVIDER_SENTINEL ? "" : v, { shouldDirty: true })}>
              <SelectTrigger><SelectValue placeholder={t("ads.providerPlaceholder")} /></SelectTrigger>
              <SelectContent>
                {PRESET_AD_PROVIDERS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                <SelectItem value={CUSTOM_PROVIDER_SENTINEL}>{t("ads.providerCustom")}</SelectItem>
              </SelectContent>
            </Select>
            {isCustom && <Input className="mt-1" placeholder={t("ads.providerPlaceholder")} {...form.register("provider")} />}
            <p className="text-xs text-destructive">{form.formState.errors.provider?.message ?? ""}</p>
          </div>

          <fieldset className="flex flex-col gap-3 rounded-card border border-border p-4">
            <legend className="px-1 text-sm font-medium">{t("adver.sectionMeta")}</legend>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField id="av-meta-name" label={t("adver.metaName")} placeholder="google-site-verification" spellCheck={false} error={form.formState.errors.metaName?.message} {...form.register("metaName")} />
              <FormField id="av-meta-content" label={t("adver.metaContent")} spellCheck={false} error={form.formState.errors.metaContent?.message} {...form.register("metaContent")} />
            </div>
            <p className="text-xs text-faint">{t("adver.metaHint")}</p>
          </fieldset>

          <fieldset className="flex flex-col gap-3 rounded-card border border-border p-4">
            <legend className="px-1 text-sm font-medium">{t("adver.sectionFile")}</legend>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField id="av-file-name" label={t("adver.fileName")} placeholder="google1234abcd.html" spellCheck={false} error={form.formState.errors.fileName?.message} {...form.register("fileName")} />
              <div className="flex items-end"><p className="text-xs text-faint">{t("adver.fileNameHint")}</p></div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="av-file-content">{t("adver.fileContent")}</Label>
              <Textarea id="av-file-content" rows={3} className="font-mono text-xs" spellCheck={false} {...form.register("fileContent")} />
              <p className="text-xs text-destructive">{form.formState.errors.fileContent?.message ?? ""}</p>
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-3 rounded-card border border-border p-4">
            <legend className="px-1 text-sm font-medium">{t("adver.sectionDns")}</legend>
            <p className="text-xs text-faint">{t("adver.dnsHint")}</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <Label>{t("adver.dnsType")}</Label>
                <Select value={form.watch("dnsType") === "" ? DNS_NONE : form.watch("dnsType")}
                  onValueChange={(v) => form.setValue("dnsType", v === DNS_NONE ? "" : (v as AdVerificationFormInput["dnsType"]), { shouldDirty: true })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={DNS_NONE}>—</SelectItem>
                    {DNS_TYPES.map((ty) => <SelectItem key={ty} value={ty}>{ty}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <FormField id="av-dns-host" label={t("adver.dnsHost")} placeholder="_txt.domain.com" {...form.register("dnsHost")} />
              <FormField id="av-dns-value" label={t("adver.dnsValue")} {...form.register("dnsValue")} />
            </div>
            <FormField id="av-dns-note" label={t("adver.dnsNote")} {...form.register("dnsNote")} />
          </fieldset>

          <label className="flex items-center gap-3 text-sm">
            <Switch checked={form.watch("isActive")} onCheckedChange={(c) => form.setValue("isActive", c, { shouldDirty: true })} />
            {t("common.enabled")}
          </label>
          <p className="-mt-3 text-xs text-faint">{t("adver.activeHint")}</p>

          {errorKey && <p role="alert" className="text-sm text-destructive">{t(errorKey)}</p>}

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>{t("common.cancel")}</Button>
            <Button type="submit" variant="gradient" disabled={submitting}>
              {submitting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {submitting ? t("common.saving") : t("common.save")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
