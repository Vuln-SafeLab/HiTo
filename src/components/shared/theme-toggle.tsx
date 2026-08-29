"use client";

import { useCallback, useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { safeLocalStorage } from "@/lib/web-utils";

type Theme = "dark" | "light";

// Historical key retained through rebrand; changing this loses user theme preferences
export const THEME_KEY = "navsite-theme";

export function ThemeToggle() {
  const t = useTranslations("common");
  // SSR always renders dark; real value read after mount to avoid hydration mismatch
  const [theme, setTheme] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark");
    setMounted(true);
  }, []);

  const toggle = useCallback(() => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      if (typeof window !== "undefined") safeLocalStorage().setItem(THEME_KEY, next);
    } catch {
      // localStorage may be unavailable in private mode — theme still applies, just not persisted
    }
    setTheme(next);
  }, [theme]);

  const label = theme === "dark" ? t("themeLight") : t("themeDark");

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={label}
      title={label}
    >
      {mounted && theme === "light" ? (
        <Moon className="size-4" aria-hidden="true" />
      ) : (
        <Sun className="size-4" aria-hidden="true" />
      )}
    </Button>
  );
}
