"use client";

import { useState } from "react";
import { ArchiveRestore, Loader2, Trash2 } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import {
  emptyTrashAction,
  purgeCardsAction,
  restoreCardsAction,
} from "@/lib/actions/cards";
import { purgeCategoryAction, restoreCategoryAction } from "@/lib/actions/categories";
import type { TrashCardItem, TrashCategoryItem } from "./types";
import { errorKeyFor } from "./utils";

interface TrashManagerProps {
  cards: TrashCardItem[];
  categories: TrashCategoryItem[];
}

export function TrashManager({ cards, categories }: TrashManagerProps) {
  const t = useTranslations();
  const format = useFormatter();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  // Pending hard-delete target: "all" | {kind, id}
  const [purgeTarget, setPurgeTarget] = useState<
    "all" | { kind: "card" | "category"; id: string } | null
  >(null);

  const isEmpty = cards.length === 0 && categories.length === 0;

  async function run(action: () => Promise<{ ok: boolean; code?: string }>): Promise<void> {
    setBusy(true);
    const outcome = await action();
    setBusy(false);
    if (outcome.ok) {
      toast.success(t("common.done"));
      router.refresh();
    } else {
      toast.error(t(errorKeyFor(outcome.code ?? "generic")));
    }
  }

  async function confirmPurge(): Promise<void> {
    const target = purgeTarget;
    setPurgeTarget(null);
    if (target === null) return;
    if (target === "all") {
      await run(() => emptyTrashAction());
    } else if (target.kind === "card") {
      await run(() => purgeCardsAction([target.id]));
    } else {
      await run(() => purgeCategoryAction(target.id));
    }
  }

  function formatDate(iso: string): string {
    return format.dateTime(new Date(iso), { dateStyle: "medium", timeStyle: "short" });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{t("admin.trash.title")}</h1>
        {!isEmpty && (
          <Button variant="destructive" disabled={busy} onClick={() => setPurgeTarget("all")}>
            <Trash2 className="size-4" aria-hidden="true" />
            {t("admin.trash.purgeAll")}
          </Button>
        )}
      </div>

      {isEmpty ? (
        <EmptyState icon={Trash2} title={t("admin.trash.empty")} body={t("admin.table.confirmDeleteBody")} />
      ) : (
        <div className="flex flex-col gap-6">
          {cards.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold text-muted-foreground">
                {t("admin.nav.cards")}
              </h2>
              <ul className="flex flex-col gap-2">
                {cards.map((card) => (
                  <li
                    key={card.id}
                    className="flex items-center gap-3 rounded-card border border-border bg-card px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{card.title}</p>
                      <p className="truncate text-xs text-faint">
                        {card.categoryName} · {t("admin.trash.deletedAt")}{" "}
                        {formatDate(card.deletedAt)}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => void run(() => restoreCardsAction([card.id]))}
                    >
                      <ArchiveRestore className="size-3.5" aria-hidden="true" />
                      {t("admin.trash.restore")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      className="text-destructive"
                      onClick={() => setPurgeTarget({ kind: "card", id: card.id })}
                    >
                      {t("admin.trash.purge")}
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {categories.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold text-muted-foreground">
                {t("admin.nav.categories")}
              </h2>
              <ul className="flex flex-col gap-2">
                {categories.map((category) => (
                  <li
                    key={category.id}
                    className="flex items-center gap-3 rounded-card border border-border bg-card px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{category.name}</p>
                      <p className="truncate text-xs text-faint">
                        /{category.slug} · {t("admin.trash.deletedAt")}{" "}
                        {formatDate(category.deletedAt)}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => void run(() => restoreCategoryAction(category.id))}
                    >
                      <ArchiveRestore className="size-3.5" aria-hidden="true" />
                      {t("admin.trash.restore")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      className="text-destructive"
                      onClick={() => setPurgeTarget({ kind: "category", id: category.id })}
                    >
                      {t("admin.trash.purge")}
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      <AlertDialog open={purgeTarget !== null} onOpenChange={(open) => !open && setPurgeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {purgeTarget === "all" ? t("admin.trash.purgeAll") : t("admin.trash.purge")}
            </AlertDialogTitle>
            <AlertDialogDescription>{t("admin.trash.confirmPurge")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={() => void confirmPurge()}>
              {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
