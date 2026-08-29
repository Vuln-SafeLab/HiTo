"use client";

import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  CircleDollarSign, Loader2, Pencil, Plus, Smartphone, Trash2,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { createAdAction, deleteAdAction, toggleAdAction, updateAdAction } from "@/lib/actions/ads";
import {
  AD_DEVICES, AD_POSITIONS, AD_TYPES, CUSTOM_PROVIDER_SENTINEL,
  MAX_AD_CODE_CHARS, PRESET_AD_PROVIDERS, adFormSchema,
  deviceLabelKey, positionLabelKey, typeLabelKey,
  type AdDeviceValue, type AdFormInput, type AdPositionValue, type AdTypeValue,
} from "@/lib/validators/ads";
import type { AdminAdItem } from "./types";
import { errorKeyFor } from "./utils";

function SelectBlock({
  label, value, options, onChange, placeholder,
}: {
  label: string; value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
        <SelectContent>{options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
}

const toLocal = (iso: string | null): string => {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const toIso = (v: string): string => v ? new Date(v).toISOString() : "";

export function AdsManager({ items }: { items: AdminAdItem[] }) {
  const t = useTranslations();
  const format = useFormatter();
  const router = useRouter();

  const [editing, setEditing] = useState<AdminAdItem | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<AdminAdItem | null>(null);
  const [busy, setBusy] = useState(false);

  const statusOf = (item: AdminAdItem) => {
    if (!item.isActive) return { key: "statusDisabled", variant: "muted" as const };
    const now = Date.now();
    if (item.startAt && new Date(item.startAt).getTime() > now) return { key: "statusScheduled", variant: "outline" as const };
    if (item.endAt && new Date(item.endAt).getTime() < now) return { key: "statusExpired", variant: "destructive" as const };
    return { key: "statusLive", variant: "success" as const };
  };

  const windowLabel = (item: AdminAdItem): string => {
    const fmt = (iso: string) => format.dateTime(new Date(iso), { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    if (!item.startAt && !item.endAt) return "—";
    return `${item.startAt ? fmt(item.startAt) : "…"} → ${item.endAt ? fmt(item.endAt) : "…"}`;
  };

  const toggle = async (item: AdminAdItem, next: boolean) => {
    setBusy(true);
    const outcome = await toggleAdAction(item.id, next);
    setBusy(false);
    if (outcome.ok) router.refresh();
    else toast.error(t(errorKeyFor(outcome.code)));
  };

  const confirmDelete = async () => {
    const target = deleting;
    setDeleting(null);
    if (!target) return;
    setBusy(true);
    const outcome = await deleteAdAction(target.id);
    setBusy(false);
    if (outcome.ok) { toast.success(t("common.done")); router.refresh(); }
    else toast.error(t(errorKeyFor(outcome.code)));
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{t("admin.nav.ads")}</h1>
        <Button variant="gradient" onClick={() => { setEditing(null); setFormOpen(true); }}>
          <Plus className="size-4" aria-hidden="true" />{t("admin.ads.new")}
        </Button>
      </div>

      {items.length === 0 ? (
        <EmptyState icon={CircleDollarSign} title={t("admin.ads.emptyTitle")} body={t("admin.ads.emptyBody")} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              {["admin.ads.alias", "ads.provider", "ads.position", "ads.type", "ads.device",
                "common.status", "admin.announcements.startAt", "ads.weight", "common.enabled",
                "common.actions"].map((k) => (
                <TableHead key={k} className={k === "common.actions" ? "w-20 text-right" : undefined}>
                  {k === "admin.announcements.startAt" ? `${t("admin.announcements.startAt")} / ${t("admin.announcements.endAt")}` : t(k)}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => {
              const s = statusOf(item);
              return (
                <TableRow key={item.id}>
                  <TableCell>
                    <p className="max-w-48 truncate font-medium">{item.alias}</p>
                    <p className="max-w-48 truncate font-mono text-xs text-faint" title={item.code.slice(0, 120)}>
                      {item.code.replace(/\s+/g, " ").slice(0, 60)}
                    </p>
                  </TableCell>
                  <TableCell><Badge variant="outline">{item.provider}</Badge></TableCell>
                  <TableCell><Badge variant="default">{t(positionLabelKey(item.position as AdPositionValue))}</Badge></TableCell>
                  <TableCell className="text-muted-foreground">{t(typeLabelKey(item.type as AdTypeValue))}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      {item.device === "MOBILE" && <Smartphone className="size-3.5" aria-hidden="true" />}
                      {t(deviceLabelKey(item.device as AdDeviceValue))}
                    </span>
                  </TableCell>
                  <TableCell><Badge variant={s.variant}>{t(`admin.announcements.${s.key}`)}</Badge></TableCell>
                  <TableCell className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">{windowLabel(item)}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{item.weight}</TableCell>
                  <TableCell><Switch checked={item.isActive} disabled={busy} onCheckedChange={(n) => void toggle(item, n)} aria-label={t("common.enabled")} /></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" aria-label={t("admin.ads.edit")} onClick={() => { setEditing(item); setFormOpen(true); }}>
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

      <AdFormDialog open={formOpen} item={editing} onClose={() => setFormOpen(false)} onSaved={() => { setFormOpen(false); router.refresh(); }} />

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

function AdFormDialog({
  open, item, onClose, onSaved,
}: {
  open: boolean; item: AdminAdItem | null; onClose: () => void; onSaved: () => void;
}) {
  const t = useTranslations();
  const [submitting, setSubmitting] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const schema = useMemo(() => adFormSchema((k, v) => t(k, v)), [t]);
  const form = useForm<AdFormInput>({ resolver: zodResolver(schema), defaultValues: emptyValues() });

  function emptyValues(): AdFormInput {
    return { provider: PRESET_AD_PROVIDERS[0], alias: "", position: "HEADER", type: "SCRIPT", code: "", isActive: true, weight: "0", device: "ALL", startAt: "", endAt: "" };
  }

  useEffect(() => {
    if (!open) return;
    form.reset(item === null ? emptyValues() : {
      provider: item.provider, alias: item.alias, position: item.position, type: item.type, code: item.code,
      isActive: item.isActive, weight: String(item.weight), device: item.device,
      startAt: toLocal(item.startAt), endAt: toLocal(item.endAt),
    });
    setErrorKey(null);
  }, [open, item, form]);

  const submit = async (values: AdFormInput) => {
    setSubmitting(true);
    setErrorKey(null);
    const payload = { ...values, startAt: toIso(values.startAt), endAt: toIso(values.endAt) };
    const outcome = item === null ? await createAdAction(payload) : await updateAdAction(item.id, payload);
    setSubmitting(false);
    if (outcome.ok) { toast.success(t("common.saved")); onSaved(); }
    else setErrorKey(errorKeyFor(outcome.code));
  };

  const providerValue = form.watch("provider");
  const isCustom = providerValue !== "" && !(PRESET_AD_PROVIDERS as readonly string[]).includes(providerValue);

  return (
    <Dialog open={open} onOpenChange={(n) => !n && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>{item === null ? t("admin.ads.new") : t("admin.ads.edit")}</DialogTitle></DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={(e) => void form.handleSubmit(submit)(e)}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>{t("ads.provider")}</Label>
              <Select value={isCustom ? CUSTOM_PROVIDER_SENTINEL : providerValue} onValueChange={(v) => form.setValue("provider", v === CUSTOM_PROVIDER_SENTINEL ? "" : v, { shouldDirty: true })}>
                <SelectTrigger><SelectValue placeholder={t("ads.providerPlaceholder")} /></SelectTrigger>
                <SelectContent>
                  {PRESET_AD_PROVIDERS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  <SelectItem value={CUSTOM_PROVIDER_SENTINEL}>{t("ads.providerCustom")}</SelectItem>
                </SelectContent>
              </Select>
              {isCustom && <Input className="mt-1" placeholder={t("ads.providerPlaceholder")} {...form.register("provider")} />}
              <p className="text-xs text-faint">{form.formState.errors.provider?.message ?? ""}</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ad-alias">{t("admin.ads.alias")}</Label>
              <Input id="ad-alias" maxLength={191} {...form.register("alias")} />
              <p className="text-xs text-faint">{t("admin.ads.aliasHint")}</p>
              <p className="text-xs text-destructive">{form.formState.errors.alias?.message ?? ""}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <SelectBlock label={t("ads.position")} value={form.watch("position")} options={AD_POSITIONS.map((p) => ({ value: p, label: t(positionLabelKey(p)) }))} onChange={(v) => form.setValue("position", v as AdPositionValue, { shouldDirty: true })} />
            <SelectBlock label={t("ads.type")} value={form.watch("type")} options={AD_TYPES.map((ty) => ({ value: ty, label: t(typeLabelKey(ty)) }))} onChange={(v) => form.setValue("type", v as AdTypeValue, { shouldDirty: true })} />
            <SelectBlock label={t("ads.device")} value={form.watch("device")} options={AD_DEVICES.map((d) => ({ value: d, label: t(deviceLabelKey(d)) }))} onChange={(v) => form.setValue("device", v as AdDeviceValue, { shouldDirty: true })} />
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between">
              <Label htmlFor="ad-code">{t("ads.code")}</Label>
              <span className="text-xs tabular-nums text-faint">{(form.watch("code") ?? "").length.toLocaleString()} / {MAX_AD_CODE_CHARS.toLocaleString()}</span>
            </div>
            <Textarea id="ad-code" rows={8} className="font-mono text-xs" spellCheck={false} {...form.register("code")} />
            <p className="text-xs text-faint">{t(form.watch("type") === "IMAGE" ? "admin.ads.codeHintImage" : "admin.ads.codeHint")}</p>
            <p className="text-xs text-destructive">{form.formState.errors.code?.message ?? ""}</p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ad-weight">{t("ads.weight")}</Label>
              <Input id="ad-weight" inputMode="numeric" {...form.register("weight")} />
              <p className="text-xs text-faint">{t("admin.ads.weightHint")}</p>
              <p className="text-xs text-destructive">{form.formState.errors.weight?.message ?? ""}</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ad-start">{t("admin.announcements.startAt")}</Label>
              <Input id="ad-start" type="datetime-local" {...form.register("startAt")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ad-end">{t("admin.announcements.endAt")}</Label>
              <Input id="ad-end" type="datetime-local" {...form.register("endAt")} />
              <p className="text-xs text-destructive">{form.formState.errors.endAt?.message ?? ""}</p>
            </div>
          </div>

          <label className="flex items-center gap-3 text-sm">
            <Switch checked={form.watch("isActive")} onCheckedChange={(c) => form.setValue("isActive", c, { shouldDirty: true })} />
            {t("common.enabled")}
          </label>

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
