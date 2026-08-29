"use client";

import { useEffect, useRef } from "react";
import { Search, X } from "lucide-react";
import { useTranslations } from "next-intl";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export function SearchBar({ value, onChange }: SearchBarProps) {
  const t = useTranslations();
  const inputRef = useRef<HTMLInputElement>(null);

  // "/" anywhere focuses search (unless the user is typing in another field)
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable) {
        return;
      }
      event.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="search-glass flex h-[52px] w-full items-center gap-2 px-4">
      <Search
        className="pointer-events-none size-[18px] shrink-0 text-faint"
        aria-hidden="true"
      />
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape" && value !== "") {
            event.preventDefault();
            onChange("");
          }
        }}
        placeholder={t("home.searchPlaceholder")}
        aria-label={t("common.search")}
        className="h-full w-full bg-transparent text-[15px] outline-none placeholder:text-faint [&::-webkit-search-cancel-button]:hidden"
      />
      {value !== "" ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label={t("common.close")}
          className="rounded p-1 text-faint transition-colors duration-150 hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-3.5" aria-hidden="true" />
        </button>
      ) : (
        <kbd
          className="hidden rounded border border-border bg-surface-2 px-1.5 py-0.5 font-sans text-[10px] font-medium text-faint sm:block"
          aria-hidden="true"
        >
          /
        </kbd>
      )}
    </div>
  );
}
