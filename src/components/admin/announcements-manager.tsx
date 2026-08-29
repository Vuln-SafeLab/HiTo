"use client";

import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Megaphone, Pencil, Plus, Trash2 } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
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
import { FieldError } from "@/components/setup/field-error";
import { EmptyState } from "@/components/shared/empty-state";
import { createAnnouncementAction, deleteAnnouncementAction, toggleAnnouncementAction, updateAnnouncementAction } from "@/lib/actions/announcements";
import { announcementFormSchema, type AnnouncementFormInput } from "@/lib/validators/content";
import type { AdminAnnouncementItem } from "./types";
import { errorKeyFor } from "./utils";

const TONES = ["INFO", "SUCCESS", "WARNING", "ERROR"] as const;

const toLocal = (iso: string | null): string => {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const toIso = (v: string): string => v ? new Date(v).toISOString() : "";

export function AnnouncementsManager({ items, showingId }: { items: AdminAnnouncementItem[]; showingId: string | null }) {
  const t = useTranslations();
  const format = useFormatter();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [editing, setEditing] = useState<AdminAnnouncementItem | null>(null);
  const [formOpen, setFormOpen] = useState(searchParams.get("new") === "1");
  const [deleting, setDeleting] = useState<AdminAnnouncementItem | null>(null);
  const [busy, setBusy] = useState(false);

  const statusOf = (item: AdminAnnouncementItem) => {
    if (!item.isActive) return { key: "statusDisabled", variant: "muted" as const };
    const now = Date.now();
    if (item.startAt && new Date(item.startAt).getTime() > now) return { key: "statusScheduled", variant: "outline" as const };
    if (item.endAt && new Date(item.endAt).getTime() < now) return { key: "statusExpired", variant: "destructive" as const };
    return { key: "statusLive", variant: "success" as const };
  };

  const windowLabel = (item: AdminAnnouncementItem): string => {
    const fmt = (iso: string) => format.dateTime(new Date(iso), { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    if (!item.startAt && !item.endAt) return "—";
    return `${item.startAt ? fmt(item.startAt) : "…"} → ${item.endAt ? fmt(item.endAt) : "…"}`;
  };

  const toggle = async (item: AdminAnnouncementItem, next: boolean) => {
    setBusy(true);
    const outcome = await toggleAnnouncementAction(item.id, next);
    setBusy(false);
    if (outcome.ok) router.refresh();
    else toast.error(t(errorKeyFor(outcome.code)));
  };

  const confirmDelete = async () => {
    const target = deleting;
    setDeleting(null);
    if (!target) return;
    setBusy(true);
    const outcome = await deleteAnnouncementAction(target.id);
    setBusy(false);
    if (outcome.ok) { toast.success(t("common.done")); router.refresh(); }
    else toast.error(t(errorKeyFor(outcome.code)));
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{t("admin.nav.announcements")}</h1>
        <Button variant="gradient" onClick={() => { setEditing(null); setFormOpen(true); }}>
          <Plus className="size-4" aria-hidden="true" />{t("admin.announcements.new")}
        </Button>
      </div>

      {items.length === 0 ? (
        <EmptyState icon={Megaphone} title={t("admin.table.empty")} body={t("admin.settings.socialsHint")} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("admin.announcements.content")}</TableHead>
              <TableHead>{t("admin.announcements.type")}</TableHead>
              <TableHead>{t("common.status")}</TableHead>
              <TableHead>{t("admin.announcements.startAt")} / {t("admin.announcements.endAt")}</TableHead>
              <TableHead className="text-right">{t("admin.announcements.priority")}</TableHead>
              <TableHead>{t("common.enabled")}</TableHead>
              <TableHead className="w-20 text-right">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => {
              const s = statusOf(item);
              return (
                <TableRow key={item.id}>
                  <TableCell>
                    <p className="max-w-72 truncate font-medium">{item.content}</p>
                    {item.id === showingId && <Badge variant="success" className="mt-1">{t("admin.announcements.showingNow")}</Badge>}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{t(`admin.announcements.type${item.type.charAt(0)}${item.type.slice(1).toLowerCase()}`)}</Badge>
                  </TableCell>
                  <TableCell><Badge variant={s.variant}>{t(`admin.announcements.${s.key}`)}</Badge></TableCell>
                  <TableCell className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">{windowLabel(item)}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{item.priority}</TableCell>
                  <TableCell><Switch checked={item.isActive} disabled={busy} onCheckedChange={(n) => void toggle(item, n)} aria-label={t("common.enabled")} /></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" aria-label={t("admin.announcements.edit")} onClick={() => { setEditing(item); setFormOpen(true); }}>
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

      <AnnouncementFormDialog open={formOpen} item={editing} onClose={() => setFormOpen(false)} onSaved={() => { setFormOpen(false); router.refresh(); }} />

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

function AnnouncementFormDialog({ open, item, onClose, onSaved }: {
  open: boolean; item: AdminAnnouncementItem | null; onClose: () => void; onSaved: () => void;
}) {
  const t = useTranslations();
  const [submitting, setSubmitting] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const schema = useMemo(() => announcementFormSchema((k, v) => t(k, v)), [t]);
  const form = useForm<AnnouncementFormInput>({
    resolver: zodResolver(schema),
    defaultValues: { content: "", linkUrl: "", linkText: "", type: "INFO", startAt: "", endAt: "", isActive: true, isDismissible: true, priority: "0" },
  });

  useEffect(() => {
    if (!open) return;
    form.reset({
      content: item?.content ?? "", linkUrl: item?.linkUrl ?? "", linkText: item?.linkText ?? "",
      type: item?.type ?? "INFO",
      startAt: toLocal(item?.startAt ?? null), endAt: toLocal(item?.endAt ?? null),
      isActive: item?.isActive ?? true, isDismissible: item?.isDismissible ?? true,
      priority: String(item?.priority ?? 0),
    });
    setErrorKey(null);
  }, [open, item, form]);

  const submit = async (values: AnnouncementFormInput) => {
    setSubmitting(true);
    setErrorKey(null);
    const payload = { ...values, startAt: toIso(values.startAt), endAt: toIso(values.endAt) };
    const outcome = item === null ? await createAnnouncementAction(payload) : await updateAnnouncementAction(item.id, payload);
    setSubmitting(false);
    if (outcome.ok) { toast.success(t("common.saved")); onSaved(); }
    else setErrorKey(errorKeyFor(outcome.code));
  };

  return (
    <Dialog open={open} onOpenChange={(n) => !n && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader><DialogTitle>{item === null ? t("admin.announcements.new") : t("admin.announcements.edit")}</DialogTitle></DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={(e) => void form.handleSubmit(submit)(e)}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ann-content">{t("admin.announcements.content")}</Label>
            <Textarea id="ann-content" rows={3} maxLength={500} {...form.register("content")} />
            <FieldError message={form.formState.errors.content?.message} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ann-link">{t("admin.announcements.link")}</Label>
              <Input id="ann-link" placeholder="https://…" {...form.register("linkUrl")} />
              <FieldError message={form.formState.errors.linkUrl?.message} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ann-link-text">{t("admin.announcements.linkText")}</Label>
              <Input id="ann-link-text" {...form.register("linkText")} />
              <FieldError message={form.formState.errors.linkText?.message} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>{t("admin.announcements.type")}</Label>
              <Select value={form.watch("type")} onValueChange={(v) => form.setValue("type", v as AnnouncementFormInput["type"], { shouldDirty: true })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TONES.map((tone) => <SelectItem key={tone} value={tone}>{t(`admin.announcements.type${tone.charAt(0)}${tone.slice(1).toLowerCase()}`)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ann-priority">{t("admin.announcements.priority")}</Label>
              <Input id="ann-priority" inputMode="numeric" {...form.register("priority")} />
              <p className="text-xs text-faint">{t("admin.announcements.priorityHint")}</p>
              <FieldError message={form.formState.errors.priority?.message} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ann-start">{t("admin.announcements.startAt")}</Label>
              <Input id="ann-start" type="datetime-local" {...form.register("startAt")} />
              <FieldError message={form.formState.errors.startAt?.message} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ann-end">{t("admin.announcements.endAt")}</Label>
              <Input id="ann-end" type="datetime-local" {...form.register("endAt")} />
              <FieldError message={form.formState.errors.endAt?.message} />
            </div>
          </div>

          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-3 text-sm">
              <Switch checked={form.watch("isActive")} onCheckedChange={(c) => form.setValue("isActive", c, { shouldDirty: true })} />
              {t("common.enabled")}
            </label>
            <label className="flex items-center gap-3 text-sm">
              <Switch checked={form.watch("isDismissible")} onCheckedChange={(c) => form.setValue("isDismissible", c, { shouldDirty: true })} />
              {t("admin.announcements.dismissible")}
            </label>
          </div>

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
