import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SeoSettingsForm } from "@/components/admin/seo-settings-form";
import { SettingsForm } from "@/components/admin/settings-form";
import { SocialsEditor } from "@/components/admin/socials-editor";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requireAdmin } from "@/lib/auth/guard";
import {
  DEFAULT_ROBOTS_TXT,
  getSeoSettingsRaw,
  getSiteSettings,
  SEO_KEYS,
  SETTINGS_KEYS,
} from "@/lib/settings";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.nav");
  return { title: t("settings") };
}

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requireAdmin();
  const [settings, seoRaw, t] = await Promise.all([
    getSiteSettings(),
    getSeoSettingsRaw(),
    getTranslations(),
  ]);

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">{t("admin.nav.settings")}</h1>
      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">{t("admin.settings.tabGeneral")}</TabsTrigger>
          <TabsTrigger value="seo">{t("admin.settings.tabSeo")}</TabsTrigger>
        </TabsList>
        <TabsContent value="general" className="flex flex-col gap-4">
          <SettingsForm
            initial={{
              siteName: settings.siteName,
              logo: settings.logo ?? "",
              maintenance: settings.maintenance,
            }}
          />
          <SocialsEditor initial={settings.socials} />
        </TabsContent>
        <TabsContent value="seo">
          <SeoSettingsForm
            initial={{
              seoTitle: seoRaw[SETTINGS_KEYS.seoTitle] ?? "",
              seoDescription: seoRaw[SETTINGS_KEYS.seoDescription] ?? "",
              titleTemplate: seoRaw[SEO_KEYS.titleTemplate] ?? "",
              keywords: seoRaw[SEO_KEYS.keywords] ?? "",
              ogImage: seoRaw[SEO_KEYS.ogImage] ?? "",
              twitterCard:
                seoRaw[SEO_KEYS.twitterCard] === "summary" ? "summary" : "summary_large_image",
              robotsTxt: seoRaw[SEO_KEYS.robotsTxt] ?? DEFAULT_ROBOTS_TXT,
              noindex: seoRaw[SEO_KEYS.noindex] === "true",
              verifyGoogle: seoRaw[SEO_KEYS.verifyGoogle] ?? "",
              verifyBing: seoRaw[SEO_KEYS.verifyBing] ?? "",
              verifyBaidu: seoRaw[SEO_KEYS.verifyBaidu] ?? "",
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
