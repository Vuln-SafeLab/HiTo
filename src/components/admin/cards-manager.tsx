"use client";

import { useEffect, useMemo, useState } from "react";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import { FileDown, GripVertical, Link2, Loader2, Pencil, Plus, SquareStack, Star, Trash2 } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { bulkSetCategoryAction, bulkSetFeaturedAction, bulkSetStatusAction, checkLinksAction, reorderCardsAction, softDeleteCardsAction } from "@/lib/actions/cards";
import { toCsv } from "@/lib/csv";
import { CardFormDialog } from "./card-form-dialog";
import type { AdminCard, AdminCategory } from "./types";
import { downloadText, errorKeyFor } from "./utils";

const LINK_CHECK_CHUNK = 25;

interface CardsManagerProps {
  cards: AdminCard[];
  categories: AdminCategory[];
}

export function CardsManager({ cards, categories }: CardsManagerProps) {
  const t = useTranslations();
  const format = useFormatter();
  const router = useRouter();
  const searchParams = useSearchParams();

  const editParam = searchParams.get("edit");
  const initialEditing =
    editParam === null ? null : (cards.find((card) => card.id === editParam) ?? null);

  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [formOpen, setFormOpen] = useState(
    searchParams.get("new") === "1" || initialEditing !== null
  );
  const [editing, setEditing] = useState<AdminCard | null>(initialEditing);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checkProgress, setCheckProgress] = useState<{ done: number; total: number } | null>(null);
  const [optimisticOrder, setOptimisticOrder] = useState<string[] | null>(null);
  useEffect(() => setOptimisticOrder(null), [cards]);

  const categoryNames = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories]
  );

  const visible = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    let list = cards.filter((card) => {
      if (categoryFilter !== "all" && card.categoryId !== categoryFilter) return false;
      if (keyword === "") return true;
      return (
        card.title.toLowerCase().includes(keyword) ||
        card.url.toLowerCase().includes(keyword) ||
        card.tags.some((tag) => tag.toLowerCase().includes(keyword))
      );
    });
    if (optimisticOrder !== null) {
      const rank = new Map(optimisticOrder.map((id, index) => [id, index]));
      list = [...list].sort(
        (a, b) => (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER)
      );
    }
    return list;
  }, [cards, categoryFilter, search, optimisticOrder]);

  // Drag-sort only meaningful under single-category + no-search filter
  const dndEnabled = categoryFilter !== "all" && search.trim() === "";

  const allVisibleSelected = visible.length > 0 && visible.every((card) => selected.has(card.id));

  function toggleAll(): void {
    setSelected((current) => {
      if (allVisibleSelected) return new Set();
      const next = new Set(current);
      for (const card of visible) next.add(card.id);
      return next;
    });
  }

  function toggleOne(id: string): void {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function afterMutation(): void {
    setSelected(new Set());
    setBusy(false);
    router.refresh();
  }

  async function runBulk(action: () => Promise<{ ok: boolean; code?: string }>): Promise<void> {
    setBusy(true);
    const outcome = await action();
    if (outcome.ok) {
      toast.success(t("common.done"));
      afterMutation();
    } else {
      setBusy(false);
      toast.error(t(errorKeyFor(outcome.code ?? "generic")));
    }
  }

  const selectedIds = [...selected];

  async function runLinkCheck(): Promise<void> {
    const targets = selectedIds.length > 0 ? selectedIds : visible.map((card) => card.id);
    if (targets.length === 0) return;
    setCheckProgress({ done: 0, total: targets.length });
    let okTotal = 0;
    let brokenTotal = 0;
    for (let start = 0; start < targets.length; start += LINK_CHECK_CHUNK) {
      const chunk = targets.slice(start, start + LINK_CHECK_CHUNK);
      const outcome = await checkLinksAction(chunk);
      if (!outcome.ok) {
        setCheckProgress(null);
        toast.error(t(errorKeyFor(outcome.code)));
        return;
      }
      okTotal += outcome.data.ok;
      brokenTotal += outcome.data.broken;
      setCheckProgress({ done: Math.min(start + chunk.length, targets.length), total: targets.length });
    }
    setCheckProgress(null);
    toast.success(t("admin.cards.checkDone", { ok: okTotal, broken: brokenTotal }));
    router.refresh();
  }

  function exportReport(): void {
    const rows: Array<Array<string | number>> = [
      ["title", "url", "category", "status", "linkStatus", "lastCheckedAt", "clicks"],
      ...visible.map((card) => [
        card.title,
        card.url,
        categoryNames.get(card.categoryId) ?? "",
        card.status,
        card.linkStatus,
        card.lastCheckedAt ?? "",
        card.clickCount,
      ]),
    ];
    downloadText("link-report.csv", toCsv(rows), "text/csv;charset=utf-8");
  }

  async function onDragEnd(result: DropResult): Promise<void> {
    if (!dndEnabled || result.destination === null || result.destination === undefined) return;
    const from = result.source.index;
    const to = result.destination.index;
    if (from === to) return;

    const ordered = visible.map((card) => card.id);
    const moved = ordered.splice(from, 1)[0];
    if (moved === undefined) return;
    ordered.splice(to, 0, moved);
    setOptimisticOrder(ordered);

    const outcome = await reorderCardsAction(categoryFilter, ordered);
    if (outcome.ok) {
      toast.success(t("admin.cards.orderSaved"));
      router.refresh();
    } else {
      setOptimisticOrder(null);
      toast.error(t(errorKeyFor(outcome.code)));
    }
  }

  function linkBadge(card: AdminCard): React.ReactNode {
    if (card.linkStatus === "OK") return <Badge variant="success">{t("admin.cards.linkOk")}</Badge>;
    if (card.linkStatus === "BROKEN") {
      return <Badge variant="destructive">{t("admin.cards.linkBroken")}</Badge>;
    }
    return <Badge variant="muted">{t("admin.cards.linkUnknown")}</Badge>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{t("admin.nav.cards")}</h1>
        <Button variant="gradient" onClick={() => { setEditing(null); setFormOpen(true); }}>
          <Plus className="size-4" aria-hidden="true" />
          {t("admin.cards.new")}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t("admin.table.searchPlaceholder")}
          className="max-w-56"
          aria-label={t("common.search")}
        />
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("common.all")}</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ms-auto flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => void runLinkCheck()}
            disabled={checkProgress !== null || visible.length === 0}
          >
            {checkProgress !== null ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Link2 className="size-4" aria-hidden="true" />
            )}
            {checkProgress !== null
              ? t("admin.cards.checking", {
                  done: checkProgress.done,
                  total: checkProgress.total,
                })
              : t("admin.cards.checkLinks")}
          </Button>
          <Button variant="outline" onClick={exportReport} disabled={visible.length === 0}>
            <FileDown className="size-4" aria-hidden="true" />
            {t("admin.cards.exportReport")}
          </Button>
        </div>
      </div>

      {selected.size > 0 && (() => {
        const bulkBtn = (key: string, action: () => Promise<{ ok: boolean; code?: string }>, variant: "secondary" = "secondary", icon?: React.ReactNode, onClick?: () => void) => (
          <Button size="sm" variant={variant} disabled={busy} onClick={onClick ?? (() => void runBulk(action))}>
            {icon}{t(key)}
          </Button>
        );
        return (
          <div className="flex flex-wrap items-center gap-2 rounded-card border border-border bg-surface-2 px-4 py-2.5">
            <span className="me-2 text-sm font-medium">{t("admin.table.selected", { count: selected.size })}</span>
            {bulkBtn("admin.bulk.publish", () => bulkSetStatusAction(selectedIds, "PUBLISHED"))}
            {bulkBtn("admin.bulk.unpublish", () => bulkSetStatusAction(selectedIds, "DRAFT"))}
            {bulkBtn("admin.bulk.feature", () => bulkSetFeaturedAction(selectedIds, true))}
            {bulkBtn("admin.bulk.unfeature", () => bulkSetFeaturedAction(selectedIds, false))}
            <Select onValueChange={(v) => void runBulk(() => bulkSetCategoryAction(selectedIds, v))}>
              <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder={t("admin.bulk.setCategory")} /></SelectTrigger>
              <SelectContent>{categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
            {bulkBtn("admin.bulk.delete", () => softDeleteCardsAction(selectedIds), "secondary", <Trash2 className="size-3.5" aria-hidden="true" />, () => setConfirmDelete(true))}
          </div>
        );
      })()}

      {visible.length === 0 ? (
        <EmptyState icon={SquareStack} title={t("admin.table.empty")} body={t("home.noResultsBody")} />
      ) : (
        <DragDropContext onDragEnd={(r) => void onDragEnd(r)}>
          <Droppable droppableId="cards" isDropDisabled={!dndEnabled}>
            {(drop) => (
              <div ref={drop.innerRef} {...drop.droppableProps}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"><Checkbox checked={allVisibleSelected} onCheckedChange={toggleAll} aria-label={t("common.all")} /></TableHead>
                      {dndEnabled && <TableHead className="w-8" />}
                      <TableHead>{t("common.title")}</TableHead>
                      <TableHead>{t("common.category")}</TableHead>
                      <TableHead>{t("common.status")}</TableHead>
                      <TableHead>{t("admin.cards.checkLinks")}</TableHead>
                      <TableHead className="text-right">{t("admin.dashboard.totalClicks")}</TableHead>
                      <TableHead className="w-20 text-right">{t("common.actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visible.map((card, i) => (
                      <Draggable key={card.id} draggableId={card.id} index={i} isDragDisabled={!dndEnabled}>
                        {(d, snap) => (
                          <TableRow
                            ref={d.innerRef}
                            {...d.draggableProps}
                            data-state={selected.has(card.id) ? "selected" : undefined}
                            className={snap.isDragging ? "bg-surface-2" : undefined}
                          >
                            <TableCell><Checkbox checked={selected.has(card.id)} onCheckedChange={() => toggleOne(card.id)} aria-label={card.title} /></TableCell>
                            {dndEnabled && (
                              <TableCell>
                                <span {...d.dragHandleProps} aria-label={t("admin.categories.dragHint")} className="inline-flex cursor-grab rounded p-1 text-faint hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                                  <GripVertical className="size-4" aria-hidden="true" />
                                </span>
                              </TableCell>
                            )}
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {card.featured && <Star className="size-3.5 shrink-0 fill-current text-faint" aria-label={t("admin.cards.featured")} />}
                                <div className="min-w-0">
                                  <p className="max-w-64 truncate font-medium">{card.title}</p>
                                  <p className="max-w-64 truncate text-xs text-faint">{card.url}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{categoryNames.get(card.categoryId) ?? "—"}</TableCell>
                            <TableCell>
                              {card.status === "PUBLISHED"
                                ? <Badge variant="success">{t("admin.cards.statusPublished")}</Badge>
                                : <Badge variant="muted">{t("admin.cards.statusDraft")}</Badge>}
                            </TableCell>
                            <TableCell>{linkBadge(card)}</TableCell>
                            <TableCell className="text-right tabular-nums text-muted-foreground">{format.number(card.clickCount)}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button variant="ghost" size="icon" aria-label={t("admin.cards.edit")} onClick={() => { setEditing(card); setFormOpen(true); }}>
                                  <Pencil className="size-4" aria-hidden="true" />
                                </Button>
                                <Button variant="ghost" size="icon" aria-label={t("common.delete")} onClick={() => { setSelected(new Set([card.id])); setConfirmDelete(true); }}>
                                  <Trash2 className="size-4 text-destructive" aria-hidden="true" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Draggable>
                    ))}
                    {drop.placeholder}
                  </TableBody>
                </Table>
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}

      <CardFormDialog
        open={formOpen}
        card={editing}
        categories={categories}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          setFormOpen(false);
          router.refresh();
        }}
      />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.table.confirmDeleteTitle", { count: selected.size })}</AlertDialogTitle>
            <AlertDialogDescription>{t("admin.table.confirmDeleteBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={() => { setConfirmDelete(false); void runBulk(() => softDeleteCardsAction(selectedIds)); }}>
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
