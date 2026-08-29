"use client";

import { useCallback, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminFormSchema, type AdminFormInput } from "@/lib/validators/setup";
import { FieldError } from "./field-error";
import { errorMessageKey, postJson } from "./shared";

interface StepAdminProps {
  onDone: () => void;
}

export function StepAdmin({ onDone }: StepAdminProps) {
  const t = useTranslations();
  const [submitting, setSubmitting] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const form = useForm<AdminFormInput>({
    resolver: zodResolver(adminFormSchema((key, values) => t(key, values))),
    defaultValues: { username: "", email: "", password: "", confirmPassword: "" },
  });

  const submit = useCallback(
    async (values: AdminFormInput) => {
      setSubmitting(true);
      setErrorKey(null);
      const result = await postJson<{ ok: true }>("/api/setup/admin", values);
      if (result.ok) {
        onDone();
        return;
      }
      setErrorKey(errorMessageKey(result.code));
      setSubmitting(false);
    },
    [onDone]
  );

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => void form.handleSubmit(submit)(event)}
    >
      <p className="text-sm text-muted-foreground">{t("setup.admin.hint")}</p>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="admin-username">{t("common.username")}</Label>
        <Input id="admin-username" autoComplete="username" {...form.register("username")} />
        <FieldError message={form.formState.errors.username?.message} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="admin-email">{t("common.email")}</Label>
        <Input id="admin-email" type="email" autoComplete="email" {...form.register("email")} />
        <FieldError message={form.formState.errors.email?.message} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="admin-password">{t("common.password")}</Label>
          <Input
            id="admin-password"
            type="password"
            autoComplete="new-password"
            {...form.register("password")}
          />
          <FieldError message={form.formState.errors.password?.message} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="admin-confirm">{t("setup.admin.confirmPassword")}</Label>
          <Input
            id="admin-confirm"
            type="password"
            autoComplete="new-password"
            {...form.register("confirmPassword")}
          />
          <FieldError message={form.formState.errors.confirmPassword?.message} />
        </div>
      </div>

      {errorKey !== null && (
        <p role="alert" className="text-sm text-destructive">
          {t(errorKey)}
        </p>
      )}

      <div>
        <Button type="submit" variant="gradient" disabled={submitting}>
          {submitting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {submitting ? t("common.saving") : t("setup.admin.create")}
        </Button>
      </div>
    </form>
  );
}
