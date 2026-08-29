import { Wrench } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { LocaleSwitcher } from "@/components/shared/locale-switcher";
import { ThemeToggle } from "@/components/shared/theme-toggle";

export async function MaintenanceView({ siteName }: { siteName: string }) {
  const t = await getTranslations("common");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="flex items-center gap-1">
        <LocaleSwitcher />
        <ThemeToggle />
      </div>
      <Wrench className="size-10 text-faint" aria-hidden="true" />
      <div>
        <p className="bg-accent-gradient bg-clip-text text-sm font-semibold text-transparent">
          {siteName}
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{t("maintenanceTitle")}</h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">{t("maintenanceBody")}</p>
      </div>
    </main>
  );
}
