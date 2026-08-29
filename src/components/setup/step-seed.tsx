"use client";

import { useCallback, useState } from "react";
import { Loader2, PackageOpen, PackagePlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { errorMessageKey, postJson } from "./shared";

interface StepSeedProps {
  onDone: () => void;
}

export function StepSeed({ onDone }: StepSeedProps) {
  const t = useTranslations();
  const [submitting, setSubmitting] = useState<"with" | "without" | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const finish = useCallback(
    async (seed: boolean) => {
      setSubmitting(seed ? "with" : "without");
      setErrorKey(null);
      const result = await postJson<{ ok: true }>("/api/setup/finish", { seed });
      if (result.ok) {
        onDone();
        return;
      }
      setErrorKey(errorMessageKey(result.code));
      setSubmitting(null);
    },
    [onDone]
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold">{t("setup.seed.title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("setup.seed.hint")}</p>
      </div>

      {errorKey !== null && (
        <p role="alert" className="text-sm text-destructive">
          {t(errorKey)}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <Button
          variant="gradient"
          onClick={() => void finish(true)}
          disabled={submitting !== null}
        >
          {submitting === "with" ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <PackagePlus className="size-4" aria-hidden="true" />
          )}
          {t("setup.seed.with")}
        </Button>
        <Button
          variant="outline"
          onClick={() => void finish(false)}
          disabled={submitting !== null}
        >
          {submitting === "without" ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <PackageOpen className="size-4" aria-hidden="true" />
          )}
          {t("setup.seed.without")}
        </Button>
      </div>
    </div>
  );
}
