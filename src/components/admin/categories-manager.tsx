"use client";

import { useEffect, useMemo, useState } from "react";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import { zodResolver } from "@hookform/resolvers/zod";
import { FolderTree, GripVertical, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FieldError } from "@/components/setup/field-error";
import { CategoryIcon, CATEGORY_ICON_NAMES } from "@/components/shared/category-icon";
import { EmptyState } from "@/components/shared/empty-state";
import {
  createCategoryAction,
  reorderCategoriesAction,
  softDeleteCategoryAction,
  updateCategoryAction,
} from "@/lib/actions/categories";
import { categoryFormSchema, type CategoryFormInput } from "@/lib/validators/content";
import type { AdminCategory } from "./types";
import { errorKeyFor, slugify } from "./utils";

export function CategoriesManager({ categories }: { categories: AdminCategory[] }) {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [list, setList] = useState<AdminCategory[]>(categories);
  useEffect(() => setList(categories), [categories]);

  const [editing, setEditing] = useState<AdminCategory | null>(null);
  const [formOpen, setFormOpen] = useState(searchParams.get("new") === "1");
  const [deleting, setDeleting] = useState<AdminCategory | null>(null);
  const [busy, setBusy] = useState(false);

  function openCreate(): void {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(category: AdminCategory): void {
    setEditing(category);
    setFormOpen(true);
  }

  async function onDragEnd(result: DropResult): Promise<void> {
    if (result.destination === null || result.destination === undefined) return;
    const from = result.source.index;
    const to = result.destination.index;
    if (from === to) return;

    const next = [...list];
    const moved = next.splice(from, 1)[0];
    if (moved === undefined) return;
    next.splice(to, 0, moved);
    setList(next);

    const outcome = await reorderCategoriesAction(next.map((item) => item.id));
    if (outcome.ok) {
      toast.success(t("admin.cards.orderSaved"));
      router.refresh();
    } else {
      setList(categories);
      toast.error(t(errorKeyFor(outcome.code)));
    }
  }

  async function confirmDelete(): Promise<void> {
    if (deleting === null) return;
    setBusy(true);
    const outcome = await softDeleteCategoryAction(deleting.id);
    setBusy(false);
    setDeleting(null);
    if (outcome.ok) {
      toast.success(t("common.done"));
      router.refresh();
    } else {
      toast.error(t(errorKeyFor(outcome.code)));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("admin.nav.categories")}</h1>
          <p className="mt-1 text-sm text-faint">{t("admin.categories.dragHint")}</p>
        </div>
        <Button variant="gradient" onClick={openCreate}>
          <Plus className="size-4" aria-hidden="true" />
          {t("admin.categories.new")}
        </Button>
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon={FolderTree}
          title={t("admin.table.empty")}
          body={t("admin.categories.dragHint")}
        />
      ) : (
        <DragDropContext onDragEnd={(result) => void onDragEnd(result)}>
          <Droppable droppableId="categories">
            {(droppable) => (
              <ul
                ref={droppable.innerRef}
                {...droppable.droppableProps}
                className="flex flex-col gap-2"
              >
                {list.map((category, index) => (
                  <Draggable key={category.id} draggableId={category.id} index={index}>
                    {(draggable, snapshot) => (
                      <li
                        ref={draggable.innerRef}
                        {...draggable.draggableProps}
                        className={`flex items-center gap-3 rounded-card border border-border bg-card px-4 py-3 ${
                          snapshot.isDragging ? "shadow-card-hover" : ""
                        }`}
                      >
                        <span
                          {...draggable.dragHandleProps}
                          aria-label={t("admin.categories.dragHint")}
                          className="cursor-grab rounded p-1 text-faint hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <GripVertical className="size-4" aria-hidden="true" />
                        </span>
                        <CategoryIcon name={category.icon} className="size-4 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{category.name}</p>
                          <p className="truncate text-xs text-faint">
                            /{category.slug} · {t("admin.categories.cardsCount", { count: category.cardCount })}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={t("admin.categories.edit")}
                          onClick={() => openEdit(category)}
                        >
                          <Pencil className="size-4" aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={t("common.delete")}
                          onClick={() => setDeleting(category)}
                        >
                          <Trash2 className="size-4 text-destructive" aria-hidden="true" />
                        </Button>
                      </li>
                    )}
                  </Draggable>
                ))}
                {droppable.placeholder}
              </ul>
            )}
          </Droppable>
        </DragDropContext>
      )}

      <CategoryFormDialog
        open={formOpen}
        category={editing}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          setFormOpen(false);
          router.refresh();
        }}
      />

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("admin.table.confirmDeleteTitle", { count: 1 })}
            </AlertDialogTitle>
            <AlertDialogDescription>{t("admin.table.confirmDeleteBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={() => void confirmDelete()}>
              {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface CategoryFormDialogProps {
  open: boolean;
  category: AdminCategory | null;
  onClose: () => void;
  onSaved: () => void;
}

function CategoryFormDialog({ open, category, onClose, onSaved }: CategoryFormDialogProps) {
  const t = useTranslations();
  const [submitting, setSubmitting] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const schema = useMemo(
    () => categoryFormSchema((key, values) => t(key, values)),
    [t]
  );
  const form = useForm<CategoryFormInput>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", slug: "", icon: "folder", description: "" },
  });

  useEffect(() => {
    if (!open) return;
    form.reset({
      name: category?.name ?? "",
      slug: category?.slug ?? "",
      icon: category?.icon ?? "folder",
      description: category?.description ?? "",
    });
    setErrorKey(null);
  }, [open, category, form]);

  async function submit(values: CategoryFormInput): Promise<void> {
    setSubmitting(true);
    setErrorKey(null);
    const outcome =
      category === null
        ? await createCategoryAction(values)
        : await updateCategoryAction(category.id, values);
    setSubmitting(false);
    if (outcome.ok) {
      toast.success(t("common.saved"));
      onSaved();
    } else {
      setErrorKey(errorKeyFor(outcome.code));
    }
  }

  const iconValue = form.watch("icon");

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {category === null ? t("admin.categories.new") : t("admin.categories.edit")}
          </DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => void form.handleSubmit(submit)(event)}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cat-name">{t("common.name")}</Label>
            <Input
              id="cat-name"
              {...form.register("name", {
                onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
                  if (category === null && !form.formState.dirtyFields.slug) {
                    form.setValue("slug", slugify(event.target.value));
                  }
                },
              })}
            />
            <FieldError message={form.formState.errors.name?.message} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cat-slug">{t("admin.categories.slug")}</Label>
              <Input id="cat-slug" {...form.register("slug")} />
              <FieldError message={form.formState.errors.slug?.message} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t("admin.categories.icon")}</Label>
              <Select
                value={iconValue}
                onValueChange={(value) => form.setValue("icon", value, { shouldDirty: true })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_ICON_NAMES.map((name) => (
                    <SelectItem key={name} value={name}>
                      <span className="flex items-center gap-2">
                        <CategoryIcon name={name} className="size-4" />
                        {name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError message={form.formState.errors.icon?.message} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cat-desc">{t("common.description")}</Label>
            <Textarea id="cat-desc" rows={2} {...form.register("description")} />
            <FieldError message={form.formState.errors.description?.message} />
          </div>

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
