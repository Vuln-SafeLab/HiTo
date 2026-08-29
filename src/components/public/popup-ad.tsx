"use client";

import { safeLocalStorage } from "@/lib/web-utils";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTranslations } from "next-intl";
import { AdCodeRenderer } from "./ad-code-renderer";

const SHOW_DELAY_MS = 4_000;
/** 6-hour suppress window (localStorage timestamp) */
const SUPPRESS_MS = 6 * 60 * 60 * 1000;
const STORAGE_KEY = "navsite-popup-ad-at";

export function PopupAd({ code }: { code: string }) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let lastShown = 0;
    try {
      if (typeof window !== "undefined") {
        lastShown = Number(safeLocalStorage().getItem(STORAGE_KEY) ?? "0");
      }
    } catch {}
    if (Number.isFinite(lastShown) && Date.now() - lastShown < SUPPRESS_MS) return;
    const timer = setTimeout(() => setOpen(true), SHOW_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  function dismiss(next: boolean): void {
    if (!next) {
      try {
        if (typeof window !== "undefined") {
          safeLocalStorage().setItem(STORAGE_KEY, String(Date.now()));
        }
      } catch {}
      setOpen(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={dismiss}>
      <DialogContent aria-describedby={undefined} className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xs font-normal uppercase tracking-wide text-muted-foreground">
            {t("ads.popupLabel")}
          </DialogTitle>
        </DialogHeader>
        <div className="max-h-[70vh] overflow-y-auto">
          <AdCodeRenderer code={code} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
