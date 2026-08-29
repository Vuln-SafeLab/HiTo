"use client";

import { Check, Loader2, RefreshCw, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { SetupStatus } from "./shared";

interface CheckRowProps {
  ok: boolean;
  label: string;
  detail?: string;
  hint?: string;
}

function CheckRow({ ok, label, detail, hint }: CheckRowProps) {
  return (
    <div className="flex items-start gap-3 rounded-control border border-border bg-surface px-4 py-3">
      <span className={`mt-0.5 ${ok ? "text-success" : "text-destructive"}`}>
        {ok ? (
          <Check className="size-4" aria-hidden="true" />
        ) : (
          <X className="size-4" aria-hidden="true" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        {detail !== undefined && (
          <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>
        )}
        {!ok && hint !== undefined && (
          <p className="mt-0.5 text-xs text-destructive">{hint}</p>
        )}
      </div>
    </div>
  );
}

interface StepEnvProps {
  status: SetupStatus;
  refreshing: boolean;
  onRecheck: () => void;
  onNext: () => void;
}

export function StepEnv({ status, refreshing, onRecheck, onNext }: StepEnvProps) {
  const t = useTranslations();
  const { node, envWrite, uploadWrite, vars } = status.checks;
  const writeOk = envWrite.ok && uploadWrite.ok;
  const allOk = node.ok && writeOk;

  const varsDetail = [
    `DATABASE_URL: ${vars.databaseUrl ? t("setup.env.present") : t("setup.env.willGenerate")}`,
    `AUTH_SECRET: ${vars.authSecret ? t("setup.env.present") : t("setup.env.willGenerate")}`,
  ].join(" · ");

  return (
    <div className="flex flex-col gap-3">
      <CheckRow
        ok={node.ok}
        label={t("setup.env.node")}
        detail={`v${node.version}`}
        hint={t("setup.env.nodeHint")}
      />
      <CheckRow ok={writeOk} label={t("setup.env.write")} hint={t("setup.env.writeHint")} />
      <CheckRow ok={true} label={t("setup.env.vars")} detail={varsDetail} />

      <div className="mt-2 flex flex-wrap gap-3">
        <Button variant="outline" onClick={onRecheck} disabled={refreshing}>
          {refreshing ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCw className="size-4" aria-hidden="true" />
          )}
          {t("setup.env.recheck")}
        </Button>
        <Button variant="gradient" onClick={onNext} disabled={!allOk || refreshing}>
          {t("common.next")}
        </Button>
      </div>
    </div>
  );
}
