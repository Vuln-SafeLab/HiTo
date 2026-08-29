"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, CheckCircle2 } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { LocaleSwitcher } from "@/components/shared/locale-switcher";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { StepAdmin } from "./step-admin";
import { StepDatabase } from "./step-database";
import { StepEnv } from "./step-env";
import { StepSeed } from "./step-seed";
import type { SetupStatus } from "./shared";

type StepId = 1 | 2 | 3 | 4;
type WizardStep = StepId | "done";

const STEP_IDS: readonly StepId[] = [1, 2, 3, 4];

function StepIndicator({ current }: { current: WizardStep }) {
  const t = useTranslations("setup");
  const currentIndex = current === "done" ? 5 : current;

  return (
    <ol className="flex items-center gap-2" aria-label={t("title")}>
      {STEP_IDS.map((id, index) => {
        const isComplete = currentIndex > id;
        const isActive = currentIndex === id;
        return (
          <li key={id} className="flex min-w-0 flex-1 items-center gap-2">
            <span
              aria-current={isActive ? "step" : undefined}
              className={`flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors duration-150 ${
                isComplete
                  ? "border-transparent bg-primary text-primary-foreground"
                  : isActive
                    ? "border-ring text-foreground"
                    : "border-border text-faint"
              }`}
            >
              {isComplete ? <Check className="size-3.5" aria-hidden="true" /> : id}
            </span>
            <span
              className={`hidden truncate text-xs sm:block ${
                isActive ? "text-foreground" : "text-faint"
              }`}
            >
              {t(`step${id}`)}
            </span>
            {index < STEP_IDS.length - 1 && <span className="h-px flex-1 bg-border" />}
          </li>
        );
      })}
    </ol>
  );
}

function DoneView() {
  const t = useTranslations("setup.done");
  return (
    <div className="flex flex-col items-center gap-4 py-6 text-center">
      <CheckCircle2 className="size-12 text-success" aria-hidden="true" />
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">{t("title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("body")}</p>
      </div>
      <div className="mt-2 flex flex-wrap justify-center gap-3">
        <Button variant="gradient" asChild>
          <Link href="/">{t("goHome")}</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/admin">{t("goAdmin")}</Link>
        </Button>
      </div>
    </div>
  );
}

export function SetupWizard() {
  const t = useTranslations("setup");
  const reduceMotion = useReducedMotion();

  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [step, setStep] = useState<WizardStep | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadStatus = useCallback(async (): Promise<SetupStatus | null> => {
    try {
      const response = await fetch("/api/setup/status", { cache: "no-store" });
      if (!response.ok) return null;
      const data = (await response.json()) as SetupStatus;
      setStatus(data);
      return data;
    } catch {
      return null;
    }
  }, []);

  // Resume from current progress on reload instead of restarting
  useEffect(() => {
    void (async () => {
      const data = await loadStatus();
      if (data === null) {
        setStep(1);
        return;
      }
      if (data.installed) {
        window.location.replace("/");
        return;
      }
      if (data.db.migrated && data.db.adminExists) setStep(4);
      else if (data.db.migrated) setStep(3);
      else setStep(1);
    })();
  }, [loadStatus]);

  const recheck = useCallback(async () => {
    setRefreshing(true);
    await loadStatus();
    setRefreshing(false);
  }, [loadStatus]);

  const advanceAfterReload = useCallback(
    async (next: WizardStep) => {
      await loadStatus();
      setStep(next);
    },
    [loadStatus]
  );

  const stepKey = step === null ? "loading" : String(step);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="bg-accent-gradient bg-clip-text text-sm font-semibold text-transparent">
            HiTo
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <LocaleSwitcher />
          <ThemeToggle />
        </div>
      </div>

      <StepIndicator current={step ?? 1} />

      <div className="rounded-card border border-border bg-card p-6">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={stepKey}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -24 }}
            transition={{ duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
          >
            {step === null || status === null ? (
              <div className="flex flex-col gap-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-3/4" />
              </div>
            ) : step === 1 ? (
              <StepEnv
                status={status}
                refreshing={refreshing}
                onRecheck={() => void recheck()}
                onNext={() => setStep(2)}
              />
            ) : step === 2 ? (
              <StepDatabase status={status} onDone={() => void advanceAfterReload(3)} />
            ) : step === 3 ? (
              <StepAdmin onDone={() => void advanceAfterReload(4)} />
            ) : step === 4 ? (
              <StepSeed onDone={() => setStep("done")} />
            ) : (
              <DoneView />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
