import { unstable_cache } from "next/cache";
import { getDb } from "@/lib/db";
import { parseSocials, type SocialLink } from "@/lib/socials";

// SystemConfig keys for site settings
export const SETTINGS_KEYS = {
  siteName: "site.name",
  logo: "site.logo",
  seoTitle: "site.seoTitle",
  seoDescription: "site.seoDescription",
  maintenance: "site.maintenance",
  socials: "site.socials",
} as const;

export interface SiteSettings {
  siteName: string;
  logo: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  maintenance: boolean;
  socials: SocialLink[];
}

const DEFAULTS: SiteSettings = {
  siteName: "HiTo",
  logo: null,
  seoTitle: null,
  seoDescription: null,
  maintenance: false,
  socials: [],
};

function emptyToNull(value: string | undefined): string | null {
  return value === undefined || value.trim() === "" ? null : value;
}

export const SETTINGS_TAG = "settings";

export const SEO_KEYS = {
  titleTemplate: "seo.titleTemplate",
  keywords: "seo.keywords",
  ogImage: "seo.ogImage",
  twitterCard: "seo.twitterCard",
  robotsTxt: "seo.robotsTxt",
  noindex: "seo.noindex",
  verifyGoogle: "seo.verifyGoogle",
  verifyBing: "seo.verifyBing",
  verifyBaidu: "seo.verifyBaidu",
} as const;

export const DEFAULT_ROBOTS_TXT = `User-agent: *
Allow: /
Disallow: /admin
Disallow: /api
`;

export interface SeoSettings {
  siteName: string;
  title: string;
  description: string | null;
  /** Must contain %s */
  titleTemplate: string;
  keywords: string | null;
  ogImage: string | null;
  twitterCard: "summary" | "summary_large_image";
  robotsTxt: string | null;
  noindex: boolean;
  verifyGoogle: string | null;
  verifyBing: string | null;
  verifyBaidu: string | null;
}

const SEO_READ_KEYS = [
  SETTINGS_KEYS.siteName,
  SETTINGS_KEYS.seoTitle,
  SETTINGS_KEYS.seoDescription,
  ...Object.values(SEO_KEYS),
];

// generateMetadata runs on every request: 5min cache + settings tag
const getCachedSeoRows = unstable_cache(
  async (): Promise<Array<[string, string]>> => {
    const rows = await getDb().systemConfig.findMany({
      where: { key: { in: SEO_READ_KEYS } },
    });
    return rows.map((row) => [row.key, row.value]);
  },
  ["seo-settings"],
  { revalidate: 300, tags: [SETTINGS_TAG] }
);

export async function getSeoSettings(): Promise<SeoSettings> {
  let map = new Map<string, string>();
  try {
    map = new Map(await getCachedSeoRows());
  } catch {
    // Not installed / DB unreachable
  }
  const siteName = emptyToNull(map.get(SETTINGS_KEYS.siteName)) ?? DEFAULTS.siteName;
  const rawTemplate = emptyToNull(map.get(SEO_KEYS.titleTemplate));
  const titleTemplate =
    rawTemplate !== null && rawTemplate.includes("%s") ? rawTemplate : `%s · ${siteName}`;
  return {
    siteName,
    title: emptyToNull(map.get(SETTINGS_KEYS.seoTitle)) ?? siteName,
    description: emptyToNull(map.get(SETTINGS_KEYS.seoDescription)),
    titleTemplate,
    keywords: emptyToNull(map.get(SEO_KEYS.keywords)),
    ogImage: emptyToNull(map.get(SEO_KEYS.ogImage)),
    twitterCard: map.get(SEO_KEYS.twitterCard) === "summary" ? "summary" : "summary_large_image",
    robotsTxt: emptyToNull(map.get(SEO_KEYS.robotsTxt)),
    noindex: map.get(SEO_KEYS.noindex) === "true",
    verifyGoogle: emptyToNull(map.get(SEO_KEYS.verifyGoogle)),
    verifyBing: emptyToNull(map.get(SEO_KEYS.verifyBing)),
    verifyBaidu: emptyToNull(map.get(SEO_KEYS.verifyBaidu)),
  };
}

export async function getSeoSettingsRaw(): Promise<Record<string, string>> {
  const rows = await getDb().systemConfig.findMany({
    where: { key: { in: SEO_READ_KEYS } },
  });
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

// Site settings render on every public request (home header/footer): cache 60s,
// invalidated via the settings tag on save (same idiom as SEO/appearance caches).
const getCachedSettingsRows = unstable_cache(
  async (): Promise<Array<[string, string]>> => {
    const rows = await getDb().systemConfig.findMany({
      where: { key: { in: Object.values(SETTINGS_KEYS) } },
    });
    return rows.map((row) => [row.key, row.value]);
  },
  ["site-settings"],
  { revalidate: 60, tags: [SETTINGS_TAG] }
);

export async function getSiteSettings(): Promise<SiteSettings> {
  try {
    const cached = await getCachedSettingsRows();
    const map = new Map(cached);
    return {
      siteName: emptyToNull(map.get(SETTINGS_KEYS.siteName)) ?? DEFAULTS.siteName,
      logo: emptyToNull(map.get(SETTINGS_KEYS.logo)),
      seoTitle: emptyToNull(map.get(SETTINGS_KEYS.seoTitle)),
      seoDescription: emptyToNull(map.get(SETTINGS_KEYS.seoDescription)),
      maintenance: map.get(SETTINGS_KEYS.maintenance) === "true",
      socials: parseSocials(map.get(SETTINGS_KEYS.socials)),
    };
  } catch {
    return DEFAULTS;
  }
}
