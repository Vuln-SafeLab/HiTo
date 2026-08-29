import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { headers } from "next/headers";
import { HomeView } from "@/components/public/home-view";
import { MaintenanceView } from "@/components/public/maintenance-view";
import { AdSlot, getPopupAd } from "@/components/public/ad-slot";
import { PopupAd } from "@/components/public/popup-ad";
import { getActiveAnnouncement } from "@/lib/announcements";
import { getEnv } from "@/lib/env";
import { getPublicData } from "@/lib/public-data";
import { getSeoSettings, getSiteSettings } from "@/lib/settings";
import { getAppearance } from "@/lib/appearance";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const [seo, t] = await Promise.all([getSeoSettings(), getTranslations("common")]);
  return {
    title: { absolute: seo.title },
    description: seo.description ?? t("tagline"),
  };
}

interface HomePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const settings = await getSiteSettings();

  if (settings.maintenance) {
    return <MaintenanceView siteName={settings.siteName} />;
  }

  const [{ categories, cards }, announcement, params, headerStore, appearance] = await Promise.all([
    getPublicData(),
    getActiveAnnouncement(),
    searchParams,
    headers(),
    getAppearance(),
  ]);

  const rawQuery = params.q;
  const initialQuery = (Array.isArray(rawQuery) ? rawQuery[0] : rawQuery)?.slice(0, 100) ?? "";

  // Inline JSON-LD requires CSP nonce; escape `<` to prevent </script> breakout from user-controlled fields.
  const appUrl = getEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const nonce = headerStore.get("x-nonce") ?? undefined;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: settings.siteName,
    url: appUrl,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${appUrl}/?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd)
            .replace(/</g, "\\u003c")
            .replace(/>/g, "\\u003e")
            .replace(/\u2028/g, "\\u2028")
            .replace(/\u2029/g, "\\u2029"),
        }}
      />
      <HomeView
        siteName={settings.siteName}
        logo={settings.logo}
        announcement={announcement}
        socials={settings.socials}
        categories={categories}
        cards={cards}
        initialQuery={initialQuery}
        heroStyle={appearance.heroStyle}
        headerAd={<AdSlot position="HEADER" className="mx-auto w-full max-w-7xl px-4 pt-3 sm:px-6" />}
        inlineAd={<AdSlot position="INLINE" className="my-2" />}
        footerAd={<AdSlot position="FOOTER" className="mb-6 flex justify-center" />}
      />
      <PopupAdSlot />
    </>
  );
}

async function PopupAdSlot() {
  const popup = await getPopupAd();
  if (popup === null) return null;
  return <PopupAd code={popup.code} />;
}
