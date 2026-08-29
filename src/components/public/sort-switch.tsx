"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";

export type SortMode = "latest" | "featured" | "alpha";

const SPRING = { type: "spring", stiffness: 300, damping: 30 } as const;
const MODES: readonly SortMode[] = ["latest", "featured", "alpha"];

interface SortSwitchProps {
  value: SortMode;
  onChange: (mode: SortMode) => void;
}

export function SortSwitch({ value, onChange }: SortSwitchProps) {
  const t = useTranslations("home");
  const labels: Record<SortMode, string> = {
    latest: t("sortLatest"),
    featured: t("sortFeatured"),
    alpha: t("sortAlpha"),
  };

  return (
    <div className="inline-flex items-center gap-1 rounded-control bg-surface-2 p-1">
      {MODES.map((mode) => {
        const isActive = value === mode;
        return (
          <button
            key={mode}
            type="button"
            onClick={() => onChange(mode)}
            aria-pressed={isActive}
            className={`relative rounded px-3 py-1 text-xs font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {isActive && (
              <motion.span
                layoutId="sort-pill"
                transition={SPRING}
                className="absolute inset-0 rounded bg-surface shadow-sm"
                aria-hidden="true"
              />
            )}
            <span className="relative z-10">{labels[mode]}</span>
          </button>
        );
      })}
    </div>
  );
}
