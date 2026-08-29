"use client";

import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Wand2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { FieldError } from "@/components/setup/field-error";
import { createCardAction, fetchUrlMetadataAction, updateCardAction } from "@/lib/actions/cards";
import { cardFormSchema, type CardFormInput } from "@/lib/validators/content";
import type { AdminCard, AdminCategory } from "./types";
import { errorKeyFor } from "./utils";

interface CardFormDialogProps {
  open: boolean;
  card: AdminCard | null;
  categories: AdminCategory[];
  onClose: () => void;
  onSaved: () => void;
}

export function CardFormDialog({ open, card, categories, onClose, onSaved }: CardFormDialogProps) {
  const t = useTranslations();
  const [submitting, setSubmitting] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const schema = useMemo(() => cardFormSchema((key, values) => t(key, values)), [t]);
  const form = useForm<CardFormInput>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      url: "",
      description: "",
      categoryId: "",
      tags: "",
      image: "",
      favicon: "",
      featured: false,
      status: "PUBLISHED",
    },
  });

  useEffect(() => {
    if (!open) return;
    form.reset({
      title: card?.title ?? "",
      url: card?.url ?? "",
      description: card?.description ?? "",
      categoryId: card?.categoryId ?? (categories[0]?.id ?? ""),
      tags: card?.tags.join(", ") ?? "",
      image: card?.image ?? "",
      favicon: card?.favicon ?? "",
      featured: card?.featured ?? false,
      status: card?.status ?? "PUBLISHED",
    });
    setErrorKey(null);
  }, [open, card, categories, form]);

  async function fetchMetadata(): Promise<void> {
    const valid = await form.trigger("url");
    if (!valid) return;
    setFetching(true);
    const outcome = await fetchUrlMetadataAction(form.getValues("url"));
    setFetching(false);
    if (!outcome.ok) {
      toast.error(t(errorKeyFor(outcome.code)));
      return;
    }
    const meta = outcome.data;
    if (meta.title !== null) form.setValue("title", meta.title, { shouldDirty: true });
    if (meta.description !== null) {
      form.setValue("description", meta.description, { shouldDirty: true });
    }
    if (meta.image !== null) form.setValue("image", meta.image, { shouldDirty: true });
    if (meta.favicon !== null) form.setValue("favicon", meta.favicon, { shouldDirty: true });
  }

  async function submit(values: CardFormInput): Promise<void> {
    setSubmitting(true);
    setErrorKey(null);
    const outcome =
      card === null
        ? await createCardAction(values)
        : await updateCardAction(card.id, values);
    setSubmitting(false);
    if (outcome.ok) {
      toast.success(t("common.saved"));
      onSaved();
    } else {
      setErrorKey(errorKeyFor(outcome.code));
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {card === null ? t("admin.cards.new") : t("admin.cards.edit")}
          </DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => void form.handleSubmit(submit)(event)}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="card-url">{t("common.url")}</Label>
            <div className="flex gap-2">
              <Input
                id="card-url"
                placeholder="https://…"
                className="flex-1"
                {...form.register("url")}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => void fetchMetadata()}
                disabled={fetching || submitting}
              >
                {fetching ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Wand2 className="size-4" aria-hidden="true" />
                )}
                {fetching ? t("admin.cards.fetching") : t("admin.cards.fetchMeta")}
              </Button>
            </div>
            <FieldError message={form.formState.errors.url?.message} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="card-title">{t("common.title")}</Label>
            <Input id="card-title" {...form.register("title")} />
            <FieldError message={form.formState.errors.title?.message} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="card-desc">{t("common.description")}</Label>
            <Textarea id="card-desc" rows={3} {...form.register("description")} />
            <FieldError message={form.formState.errors.description?.message} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>{t("common.category")}</Label>
              <Select
                value={form.watch("categoryId")}
                onValueChange={(value) =>
                  form.setValue("categoryId", value, { shouldDirty: true })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError message={form.formState.errors.categoryId?.message} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t("common.status")}</Label>
              <Select
                value={form.watch("status")}
                onValueChange={(value) =>
                  form.setValue("status", value === "DRAFT" ? "DRAFT" : "PUBLISHED", {
                    shouldDirty: true,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PUBLISHED">{t("admin.cards.statusPublished")}</SelectItem>
                  <SelectItem value="DRAFT">{t("admin.cards.statusDraft")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="card-tags">{t("common.tags")}</Label>
            <Input id="card-tags" placeholder="tag1, tag2" {...form.register("tags")} />
            <FieldError message={form.formState.errors.tags?.message} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="card-image">{t("admin.cards.image")}</Label>
              <Input id="card-image" placeholder="https://…" {...form.register("image")} />
              <FieldError message={form.formState.errors.image?.message} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="card-favicon">{t("admin.cards.favicon")}</Label>
              <Input id="card-favicon" placeholder="https://…" {...form.register("favicon")} />
              <FieldError message={form.formState.errors.favicon?.message} />
            </div>
          </div>

          <label className="flex items-center gap-3 text-sm">
            <Switch
              checked={form.watch("featured")}
              onCheckedChange={(checked) =>
                form.setValue("featured", checked, { shouldDirty: true })
              }
            />
            {t("admin.cards.featured")}
          </label>

          {errorKey !== null && (
            <p role="alert" className="text-sm text-destructive">
              {t(errorKey)}
            </p>
          )}

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              {t("common.cancel")}
            </Button>
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
