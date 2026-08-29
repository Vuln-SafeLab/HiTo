"use client";

import { useEffect } from "react";
import { CloudOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

interface HomeErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

// Fallback for data-layer errors (typical: DB unreachable): show only human-readable message;
// stack traces and connection strings always stay in server logs.
export default function HomeError({ error, reset }: HomeErrorProps) {
  const t = useTranslations();

  useEffect(() => {
    console.error("[home] render failed:", error.digest ?? error.message);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <CloudOff className="size-10 text-faint" aria-hidden="true" />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("home.errorTitle")}</h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">{t("home.errorBody")}</p>
      </div>
      <Button variant="outline" onClick={reset}>
        {t("common.retry")}
      </Button>
    </main>
  );
}
