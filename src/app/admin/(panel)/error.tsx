"use client";

import { useEffect } from "react";
import { CloudOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

interface AdminErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

// Fallback for admin data-layer errors: same friendly copy as the public site; stack goes to server logs only.
export default function AdminError({ error, reset }: AdminErrorProps) {
  const t = useTranslations();

  useEffect(() => {
    console.error("[admin] render failed:", error.digest ?? error.message);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <CloudOff className="size-10 text-faint" aria-hidden="true" />
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{t("home.errorTitle")}</h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">{t("home.errorBody")}</p>
      </div>
      <Button variant="outline" onClick={reset}>
        {t("common.retry")}
      </Button>
    </div>
  );
}
