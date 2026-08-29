"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/setup/field-error";
import { loginAction } from "@/lib/actions/auth";

interface LoginInput {
  username: string;
  password: string;
}

export function LoginForm() {
  const t = useTranslations();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const schema = z.object({
    username: z.string().min(1, t("validation.required")),
    password: z.string().min(1, t("validation.required")),
  });

  const form = useForm<LoginInput>({
    resolver: zodResolver(schema),
    defaultValues: { username: "", password: "" },
  });

  async function submit(values: LoginInput): Promise<void> {
    setSubmitting(true);
    setErrorKey(null);
    const result = await loginAction(values);
    if (result.ok) {
      router.replace("/admin");
      router.refresh();
      return;
    }
    const map: Record<string, string> = {
      invalid: "auth.invalid",
      disabled: "auth.disabled",
      locked: "auth.locked",
      rateLimited: "errors.rateLimited",
      forbidden: "errors.forbidden",
    };
    setErrorKey(map[result.code] ?? "errors.generic");
    setSubmitting(false);
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => void form.handleSubmit(submit)(event)}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="login-username">{t("common.username")}</Label>
        <Input id="login-username" autoComplete="username" {...form.register("username")} />
        <FieldError message={form.formState.errors.username?.message} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="login-password">{t("common.password")}</Label>
        <Input
          id="login-password"
          type="password"
          autoComplete="current-password"
          {...form.register("password")}
        />
        <FieldError message={form.formState.errors.password?.message} />
      </div>

      {errorKey !== null && (
        <p role="alert" className="text-sm text-destructive">
          {t(errorKey)}
        </p>
      )}

      <Button type="submit" variant="gradient" disabled={submitting}>
        {submitting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        {submitting ? t("auth.signingIn") : t("auth.signIn")}
      </Button>
    </form>
  );
}
