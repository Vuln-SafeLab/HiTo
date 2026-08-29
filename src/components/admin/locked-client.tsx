"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Lock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/setup/field-error";
import { unlockEarlyAction } from "@/lib/actions/waf-lock";

export function LockedClient({ untilIso }: { untilIso: string }) {
  const t = useTranslations();
  const [remaining, setRemaining] = useState("--:--:--");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      const diff = new Date(untilIso).getTime() - Date.now();
      if (diff <= 0) { window.location.href = "/admin/login"; return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    }, 1000);
    return () => clearInterval(timer);
  }, [untilIso]);

  async function submit(): Promise<void> {
    if (password === "") return;
    setSubmitting(true);
    setErrorKey(null);
    const result = await unlockEarlyAction({ password });
    setSubmitting(false);
    if (result.ok) {
      window.location.href = "/admin";
    } else {
      setErrorKey(result.code === "rateLimited" ? "errors.rateLimited"
        : result.code === "invalid" ? "auth.invalid" : "errors.generic");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full bg-destructive/15">
          <Lock className="size-8 text-destructive" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("waf.lockedTitle")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("waf.lockedBody")}</p>
        <p className="my-6 text-4xl font-bold tabular-nums tracking-wider">{remaining}</p>

        <div className="rounded-card border border-border bg-card p-5 text-left">
          <Label htmlFor="unlock-pass" className="mb-2 block text-sm">{t("waf.unlockEarly")}</Label>
          <form className="flex flex-col gap-3"
            onSubmit={(e) => { e.preventDefault(); void submit(); }}>
            <Input id="unlock-pass" type="password" autoComplete="current-password"
              value={password} onChange={(e) => setPassword(e.target.value)} />
            {errorKey !== null && <FieldError message={t(errorKey)} />}
            <Button type="submit" variant="outline" disabled={submitting || password === ""}>
              {submitting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {t("waf.unlockBtn")}
            </Button>
          </form>
        </div>
      </div>
    </main>
  );
}
