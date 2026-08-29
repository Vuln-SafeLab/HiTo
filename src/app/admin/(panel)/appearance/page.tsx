import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AppearanceManager } from "@/components/admin/appearance-manager";
import { requireAdmin } from "@/lib/auth/guard";
import { getAppearanceRaw } from "@/lib/appearance";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.nav");
  return { title: t("appearance") };
}

export const dynamic = "force-dynamic";

export default async function AppearancePage() {
  await requireAdmin();
  const [appearance, t] = await Promise.all([getAppearanceRaw(), getTranslations()]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("admin.nav.appearance")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("admin.appearance.subtitle")}</p>
      </div>
      <AppearanceManager initial={appearance} />
    </div>
  );
}
