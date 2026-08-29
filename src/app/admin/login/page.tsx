import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { LoginForm } from "@/components/admin/login-form";
import { LocaleSwitcher } from "@/components/shared/locale-switcher";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { getSessionUser } from "@/lib/auth/guard";
import { getSiteSettings } from "@/lib/settings";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("title") };
}

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  // middleware only checks cookie presence; real check here — already logged in -> go to admin.
  const user = await getSessionUser();
  if (user !== null) {
    redirect("/admin");
  }

  const [settings, t] = await Promise.all([getSiteSettings(), getTranslations("auth")]);

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <p className="bg-accent-gradient bg-clip-text text-sm font-semibold text-transparent">
              {settings.siteName}
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">{t("title")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("subtitle", { siteName: settings.siteName })}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <LocaleSwitcher />
            <ThemeToggle />
          </div>
        </div>
        <div className="rounded-card border border-border bg-card p-6">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
