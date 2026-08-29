import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { headers } from "next/headers";
import { Toaster } from "@/components/ui/sonner";
import { getAdVerificationMetas } from "@/lib/ads";
import { getEnv } from "@/lib/env";
import { getSeoSettings } from "@/lib/settings";
import { getAppearance, RADIUS_TOKENS } from "@/lib/appearance";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const [seo, t, adMetas] = await Promise.all([
    getSeoSettings(),
    getTranslations("common"),
    getAdVerificationMetas(),
  ]);
  const keywords = seo.keywords
    ?.split(",")
    .map((word) => word.trim())
    .filter((word) => word !== "");

  return {
    metadataBase: new URL(getEnv().NEXT_PUBLIC_APP_URL),
    title: { default: seo.title, template: seo.titleTemplate },
    description: seo.description ?? t("tagline"),
    ...(keywords !== undefined && keywords.length > 0 ? { keywords } : {}),
    alternates: { canonical: "./" },
    openGraph: {
      siteName: seo.siteName,
      type: "website",
      ...(seo.ogImage !== null ? { images: [seo.ogImage] } : {}),
    },
    twitter: { card: seo.twitterCard },
    verification: {
      ...(seo.verifyGoogle !== null ? { google: seo.verifyGoogle } : {}),
      other: {
        ...(seo.verifyBing !== null ? { "msvalidate.01": [seo.verifyBing] } : {}),
        ...(seo.verifyBaidu !== null ? { "baidu-site-verification": [seo.verifyBaidu] } : {}),
        ...Object.fromEntries(adMetas.map((meta) => [meta.name, [meta.content]])),
      },
    },
    ...(seo.noindex ? { robots: { index: false, follow: false } } : {}),
  };
}

function buildThemeInitScript(defaultTheme: string): string {
  return `try{var t=localStorage&&localStorage.getItem&&localStorage.getItem("navsite-theme");if(t!=="light"&&t!=="dark"){t=${JSON.stringify(defaultTheme)}}document.documentElement.dataset.theme=t}catch(e){}`;
}

const glassTierScript = `(function(){try{var d=document.documentElement,ua=navigator.userAgent;var hasBD=CSS.supports('backdrop-filter','blur(1px)')||CSS.supports('-webkit-backdrop-filter','blur(1px)');var reduceT=matchMedia('(prefers-reduced-transparency: reduce)').matches;var forced=matchMedia('(forced-colors: active)').matches;var lowEnd=(navigator.hardwareConcurrency||8)<=4||(navigator.deviceMemory||8)<=4;var isChromium=!!(navigator.userAgentData&&navigator.userAgentData.brands&&navigator.userAgentData.brands.some(function(b){return /Chromium/.test(b.brand)}))||(/Chrome|Chromium|Edg|OPR/.test(ua)&&!/OPiOS|CriOS|FxiOS|EdgiOS/.test(ua));var tier=(!hasBD||reduceT||forced)?'c':(isChromium&&!lowEnd)?'a':'b';d.dataset.glassTier=tier}catch(e){document.documentElement.dataset.glassTier='b'}})();`;

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  const messages = await getMessages();
  const appearance = await getAppearance();
  // Production CSP uses nonce; inline theme script must carry middleware nonce.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  const radius = RADIUS_TOKENS[appearance.radius];
  const appearanceCss = `:root{--accent-from:${appearance.accentFrom};--accent-to:${appearance.accentTo};--ring:${appearance.accentFrom};--radius-card:${radius.card};--radius-control:${radius.control}}`;

  return (
    <html lang={locale} data-theme={appearance.defaultTheme} suppressHydrationWarning>
      <head>
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{ __html: buildThemeInitScript(appearance.defaultTheme) }}
        />
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: glassTierScript }} />
        <style nonce={nonce} dangerouslySetInnerHTML={{ __html: appearanceCss }} />
        <meta name="theme-color" content={appearance.accentFrom} />
      </head>
      <body className={`${GeistSans.variable} font-sans`}>
        <NextIntlClientProvider messages={messages}>
          {children}
          <Toaster />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
