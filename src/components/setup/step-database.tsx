"use client";

import { useCallback, useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Loader2, PlugZap } from "lucide-react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { dbConfigFormSchema, type DbConfigFormInput } from "@/lib/validators/setup";
import { FieldError } from "./field-error";
import { apiErrorText, errorMessageKey, postJson, type ApiError, type SetupStatus } from "./shared";

interface TestSuccess {
  ok: true;
}

interface StepDatabaseProps {
  status: SetupStatus;
  onDone: () => void;
}

export function StepDatabase({ status, onDone }: StepDatabaseProps) {
  const t = useTranslations();
  // useExisting: DATABASE_URL injected by platform (container volume) — skip form, just probe + migrate
  const useExisting = status.db.configured;

  const form = useForm<DbConfigFormInput>({
    resolver: zodResolver(dbConfigFormSchema((key, values) => t(key, values))),
    defaultValues: { dataDir: "./data" },
  });

  const [testResult, setTestResult] = useState<TestSuccess | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [applying, setApplying] = useState(false);

  const buildBody = useCallback((): unknown => {
    if (useExisting) return { useExisting: true };
    return form.getValues();
  }, [form, useExisting]);

  const runTest = useCallback(async () => {
    if (!useExisting) {
      const valid = await form.trigger();
      if (!valid) return;
    }
    setTesting(true);
    setErrorKey(null);
    setErrorDetail(null);
    setTestResult(null);
    const result = await postJson<TestSuccess>("/api/setup/test-connection", buildBody());
    if (result.ok) {
      setTestResult(result);
    } else {
      setErrorKey(errorMessageKey(result.code));
      setErrorDetail(apiErrorText(result as ApiError));
    }
    setTesting(false);
  }, [buildBody, form, useExisting]);

  useEffect(() => {
    if (useExisting) void runTest();
  }, [useExisting, runTest]);

  const apply = useCallback(async () => {
    if (!useExisting) {
      const valid = await form.trigger();
      if (!valid) return;
    }
    setApplying(true);
    setErrorKey(null);
    setErrorDetail(null);
    const result = await postJson<{ ok: true }>("/api/setup/database", buildBody());
    if (result.ok) {
      onDone();
      return;
    }
    setErrorKey(errorMessageKey(result.code));
    setErrorDetail(apiErrorText(result as ApiError));
    setApplying(false);
  }, [buildBody, form, onDone, useExisting]);

  return (
    <div className="flex flex-col gap-4">
      {useExisting ? (
        <p className="rounded-control border border-border bg-surface px-4 py-3 text-sm text-muted-foreground">
          {t("setup.db.existing")}
        </p>
      ) : (
        <form className="flex flex-col gap-4" onSubmit={(event) => event.preventDefault()}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="db-dataDir">{t("setup.db.dataDir")}</Label>
            <Input
              id="db-dataDir"
              autoComplete="off"
              spellCheck={false}
              placeholder="./data"
              {...form.register("dataDir")}
            />
            <FieldError message={form.formState.errors.dataDir?.message} />
            <p className="text-xs text-faint">{t("setup.db.dataDirHint")}</p>
          </div>
        </form>
      )}

      {testResult !== null && (
        <p className="flex items-center gap-2 text-sm text-success" role="status">
          <CheckCircle2 className="size-4" aria-hidden="true" />
          {t("setup.db.ok")}
        </p>
      )}
      {errorKey !== null && (
        <div role="alert" className="text-sm text-destructive">
          <p>{t(errorKey)}</p>
          {errorDetail !== null && (
            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-control bg-surface-2 p-3 text-xs text-muted-foreground">
              {errorDetail}
            </pre>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <Button variant="outline" onClick={() => void runTest()} disabled={testing || applying}>
          {testing ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <PlugZap className="size-4" aria-hidden="true" />
          )}
          {testing ? t("setup.db.testing") : t("setup.db.test")}
        </Button>
        <Button
          variant="gradient"
          onClick={() => void apply()}
          disabled={testResult === null || testing || applying}
        >
          {applying && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {applying ? t("setup.db.migrating") : t("setup.db.migrate")}
        </Button>
      </div>
    </div>
  );
}
