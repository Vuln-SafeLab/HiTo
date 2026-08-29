"use client";

import { safeLocalStorage } from "@/lib/web-utils";
import { useEffect, useState } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ActiveAnnouncement, AnnouncementTone } from "@/lib/announcements-shared";

const TONE_STYLES: Record<
  AnnouncementTone,
  { icon: typeof Info; iconClass: string; borderClass: string }
> = {
  INFO: { icon: Info, iconClass: "text-ring", borderClass: "border-l-ring" },
  SUCCESS: { icon: CheckCircle2, iconClass: "text-success", borderClass: "border-l-success" },
  WARNING: { icon: AlertTriangle, iconClass: "text-warning", borderClass: "border-l-warning" },
  ERROR: { icon: AlertCircle, iconClass: "text-destructive", borderClass: "border-l-destructive" },
};

function dismissKey(id: string): string {
  return `dismissed_announcement_${id}`;
}

/** SSR-first render. After mount, localStorage re-checks dismissal (new id bypasses prior dismissals). */
export function AnnouncementBanner({ announcement }: { announcement: ActiveAnnouncement | null }) {
  const t = useTranslations();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (announcement === null) return;
    try {
      setDismissed(safeLocalStorage().getItem(dismissKey(announcement.id)) === "1");
    } catch {
      // localStorage unavailable (private mode): banner still shows, dismissal just won't persist
    }
  }, [announcement]);

  if (announcement === null || dismissed) return null;

  const tone = TONE_STYLES[announcement.type];
  const Icon = tone.icon;

  function dismiss(): void {
    if (announcement === null) return;
    try {
      safeLocalStorage().setItem(dismissKey(announcement.id), "1");
    } catch {
      // When persistence fails, hide only for the current session
    }
    setDismissed(true);
  }

  return (
    <div
      role="status"
      className={`flex items-start gap-2.5 border-b border-l-4 border-border bg-surface-2 px-4 py-2.5 text-sm sm:items-center ${tone.borderClass}`}
    >
      <Icon className={`mt-0.5 size-4 shrink-0 sm:mt-0 ${tone.iconClass}`} aria-hidden="true" />
      <p className="min-w-0 flex-1 text-foreground">
        {announcement.content}
        {announcement.linkUrl !== null && (
          <a
            href={announcement.linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ms-2 whitespace-nowrap font-medium underline decoration-current underline-offset-4 hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {announcement.linkText ?? t("home.learnMore")}
          </a>
        )}
      </p>
      {announcement.isDismissible && (
        <button
          type="button"
          onClick={dismiss}
          aria-label={t("common.close")}
          className="shrink-0 rounded p-1 text-faint transition-colors duration-150 hover:bg-surface-3 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
