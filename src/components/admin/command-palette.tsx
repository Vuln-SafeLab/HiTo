"use client";

import { useEffect, useState } from "react";
import type { Role } from "@/lib/app-enums";
import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";

// Lazy-load the panel body: cmdk and search logic stay out of the admin first-paint bundle
const CommandPaletteDialog = dynamic(() => import("./command-palette-dialog"), {
  ssr: false,
});

export function CommandPalette({ role }: { role: Role }) {
  const t = useTranslations("admin.cmdk");
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setLoaded(true);
        setOpen((current) => !current);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setLoaded(true);
          setOpen(true);
        }}
        className="flex items-center gap-2 rounded-control border border-border bg-surface px-3 py-1.5 text-sm text-faint transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Search className="size-3.5" aria-hidden="true" />
        <span className="hidden sm:inline">{t("placeholder")}</span>
        <kbd className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd>
      </button>

      {loaded && <CommandPaletteDialog open={open} onOpenChange={setOpen} role={role} />}
    </>
  );
}
