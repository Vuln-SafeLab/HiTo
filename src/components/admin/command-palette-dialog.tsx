"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import type { Role } from "@/lib/app-enums";
import { Command } from "cmdk";
import { FolderTree, Link2, Loader2, SquareStack, Tag } from "lucide-react";
import { THEME_KEY } from "@/components/shared/theme-toggle";
import { safeLocalStorage } from "@/lib/web-utils";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { logoutAction } from "@/lib/actions/auth";
import {
  COMMAND_REGISTRY,
  type CommandEntry,
  type CommandSearchResult,
} from "@/lib/command-registry";

// Historical key name (preserved through brand rename): do not change
const RECENT_KEY = "navsite_cmdk_recent";
const RECENT_MAX = 5;
const DEBOUNCE_MS = 300;

interface RecentItem {
  key: string;
  commandId?: string;
  label?: string;
  href?: string;
}

function loadRecents(): RecentItem[] {
  try {
    const raw = safeLocalStorage().getItem(RECENT_KEY);
    if (raw === null) return [];
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data
      .filter(
        (item): item is RecentItem =>
          typeof item === "object" && item !== null && typeof (item as RecentItem).key === "string"
      )
      .slice(0, RECENT_MAX);
  } catch {
    return [];
  }
}

function saveRecent(item: RecentItem): void {
  try {
    const next = [item, ...loadRecents().filter((r) => r.key !== item.key)].slice(0, RECENT_MAX);
    safeLocalStorage().setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Silent on localStorage failure: recents are an enhancement only
  }
}

const ITEM_CLASS =
  "flex cursor-default select-none items-center gap-2.5 rounded-control px-2.5 py-2 text-sm text-muted-foreground data-[selected=true]:bg-surface-2 data-[selected=true]:text-foreground [&_svg]:size-4 [&_svg]:shrink-0";
const GROUP_CLASS =
  "[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-faint";

interface CommandPaletteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: Role;
}

export default function CommandPaletteDialog({ open, onOpenChange, role }: CommandPaletteDialogProps) {
  const t = useTranslations();
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CommandSearchResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [recents, setRecents] = useState<RecentItem[]>([]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setResults(null);
      setRecents(loadRecents());
    }
  }, [open]);

  useEffect(() => {
    const keyword = query.trim();
    if (keyword === "") {
      setResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void fetch(`/api/admin/command-search?q=${encodeURIComponent(keyword)}`, {
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok) return;
          const payload: unknown = await response.json();
          if (
            typeof payload === "object" &&
            payload !== null &&
            (payload as { ok?: unknown }).ok === true
          ) {
            setResults((payload as { data: CommandSearchResult }).data);
          }
        })
        .catch(() => undefined)
        .finally(() => setSearching(false));
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const entries = useMemo(
    () => COMMAND_REGISTRY.filter((entry) => entry.adminOnly !== true || role === "ADMIN"),
    [role]
  );

  const keyword = query.trim().toLowerCase();
  const matchedEntries = useMemo(() => {
    if (keyword === "") return entries;
    return entries.filter(
      (entry) =>
        t(entry.labelKey).toLowerCase().includes(keyword) ||
        entry.keywords.some((alias) => alias.toLowerCase().includes(keyword))
    );
  }, [entries, keyword, t]);

  const runAction = useCallback(
    (entry: CommandEntry): void => {
      onOpenChange(false);
      switch (entry.actionId) {
        case "logout":
          startTransition(() => void logoutAction());
          return;
        case "toggleTheme": {
          const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
          document.documentElement.dataset.theme = next;
          try {
            safeLocalStorage().setItem(THEME_KEY, next);
          } catch {
            // Skip persistence under privacy mode; theme still applies for this session
          }
          return;
        }
        case "openSite":
          window.open("/", "_blank", "noopener");
          return;
        default:
          return;
      }
    },
    [onOpenChange, startTransition]
  );

  const executeEntry = useCallback(
    (entry: CommandEntry): void => {
      saveRecent({ key: entry.id, commandId: entry.id });
      if (entry.href !== undefined) {
        onOpenChange(false);
        router.push(entry.href);
        return;
      }
      runAction(entry);
    },
    [onOpenChange, router, runAction]
  );

  const executeLink = useCallback(
    (label: string, href: string): void => {
      saveRecent({ key: `link:${href}`, label, href });
      onOpenChange(false);
      router.push(href);
    },
    [onOpenChange, router]
  );

  const executeRecent = useCallback(
    (item: RecentItem): void => {
      if (item.commandId !== undefined) {
        const entry = entries.find((candidate) => candidate.id === item.commandId);
        if (entry !== undefined) executeEntry(entry);
        return;
      }
      if (item.href !== undefined) {
        executeLink(item.label ?? item.href, item.href);
      }
    },
    [entries, executeEntry, executeLink]
  );

  const visibleRecents = useMemo(
    () =>
      recents.filter(
        (item) => item.commandId === undefined || entries.some((entry) => entry.id === item.commandId)
      ),
    [recents, entries]
  );

  function renderEntryItem(entry: CommandEntry): React.ReactNode {
    const Icon = entry.icon;
    return (
      <Command.Item
        key={entry.id}
        value={entry.id}
        onSelect={() => executeEntry(entry)}
        className={ITEM_CLASS}
      >
        <Icon aria-hidden="true" />
        {t(entry.labelKey)}
      </Command.Item>
    );
  }

  const hasSearchResults =
    results !== null &&
    (results.cards.length > 0 || results.categories.length > 0 || results.tags.length > 0);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-[18%] z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 overflow-hidden rounded-card border border-border bg-popover shadow-lg data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          <DialogPrimitive.Title className="sr-only">
            {t("admin.cmdk.placeholder")}
          </DialogPrimitive.Title>
          <Command label={t("admin.cmdk.placeholder")} shouldFilter={false}>
            <div className="relative">
              <Command.Input
                value={query}
                onValueChange={setQuery}
                placeholder={t("admin.cmdk.placeholder")}
                className="h-12 w-full border-b border-border bg-transparent px-4 pe-10 text-sm outline-none placeholder:text-faint"
              />
              {searching && (
                <Loader2
                  className="absolute end-3.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-faint"
                  aria-hidden="true"
                />
              )}
            </div>
            <Command.List className="max-h-80 overflow-y-auto p-2">
              <Command.Empty className="px-2.5 py-6 text-center text-sm text-faint">
                {t("admin.table.empty")}
              </Command.Empty>

              {keyword === "" && visibleRecents.length > 0 && (
                <Command.Group heading={t("admin.cmdk.recent")} className={GROUP_CLASS}>
                  {visibleRecents.map((item) => {
                    if (item.commandId !== undefined) {
                      const entry = entries.find((candidate) => candidate.id === item.commandId);
                      if (entry === undefined) return null;
                      const Icon = entry.icon;
                      return (
                        <Command.Item
                          key={`recent-${item.key}`}
                          value={`recent-${item.key}`}
                          onSelect={() => executeRecent(item)}
                          className={ITEM_CLASS}
                        >
                          <Icon aria-hidden="true" />
                          {t(entry.labelKey)}
                        </Command.Item>
                      );
                    }
                    return (
                      <Command.Item
                        key={`recent-${item.key}`}
                        value={`recent-${item.key}`}
                        onSelect={() => executeRecent(item)}
                        className={ITEM_CLASS}
                      >
                        <Link2 aria-hidden="true" />
                        {item.label ?? item.href}
                      </Command.Item>
                    );
                  })}
                </Command.Group>
              )}

              {hasSearchResults && results !== null && (
                <>
                  {results.cards.length > 0 && (
                    <Command.Group heading={t("admin.nav.cards")} className={GROUP_CLASS}>
                      {results.cards.map((card) => (
                        <Command.Item
                          key={`card-${card.id}`}
                          value={`card-${card.id}`}
                          onSelect={() => executeLink(card.title, `/admin/cards?edit=${card.id}`)}
                          className={ITEM_CLASS}
                        >
                          <SquareStack aria-hidden="true" />
                          <span className="min-w-0 flex-1 truncate">{card.title}</span>
                          <span className="max-w-32 truncate text-xs text-faint">{card.url}</span>
                        </Command.Item>
                      ))}
                    </Command.Group>
                  )}
                  {results.categories.length > 0 && (
                    <Command.Group heading={t("admin.nav.categories")} className={GROUP_CLASS}>
                      {results.categories.map((category) => (
                        <Command.Item
                          key={`category-${category.id}`}
                          value={`category-${category.id}`}
                          onSelect={() => executeLink(category.name, "/admin/categories")}
                          className={ITEM_CLASS}
                        >
                          <FolderTree aria-hidden="true" />
                          <span className="min-w-0 flex-1 truncate">{category.name}</span>
                          <span className="text-xs text-faint">/{category.slug}</span>
                        </Command.Item>
                      ))}
                    </Command.Group>
                  )}
                  {results.tags.length > 0 && (
                    <Command.Group heading={t("common.tags")} className={GROUP_CLASS}>
                      {results.tags.map((tag) => (
                        <Command.Item
                          key={`tag-${tag.id}`}
                          value={`tag-${tag.id}`}
                          onSelect={() =>
                            executeLink(tag.name, `/admin/cards?q=${encodeURIComponent(tag.name)}`)
                          }
                          className={ITEM_CLASS}
                        >
                          <Tag aria-hidden="true" />
                          {tag.name}
                        </Command.Item>
                      ))}
                    </Command.Group>
                  )}
                </>
              )}

              {matchedEntries.some((entry) => entry.group === "pages") && (
                <Command.Group heading={t("admin.cmdk.pages")} className={GROUP_CLASS}>
                  {matchedEntries.filter((entry) => entry.group === "pages").map(renderEntryItem)}
                </Command.Group>
              )}
              {matchedEntries.some((entry) => entry.group === "actions") && (
                <Command.Group heading={t("admin.cmdk.actions")} className={GROUP_CLASS}>
                  {matchedEntries.filter((entry) => entry.group === "actions").map(renderEntryItem)}
                </Command.Group>
              )}
            </Command.List>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
