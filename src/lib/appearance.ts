import { unstable_cache } from "next/cache";
import { getDb } from "@/lib/db";
import {
  DEFAULT_APPEARANCE,
  parseAppearanceJson,
  type Appearance,
} from "@/lib/appearance-shared";

// ─── Admin-defined frontend appearance (server) ───
// Stored as one JSON blob under SystemConfig key "site.appearance".
// Values are injected as CSS variables in the root layout <head>.

export const APPEARANCE_KEY = "site.appearance";
export const APPEARANCE_TAG = "appearance";

export {
  DEFAULT_APPEARANCE,
  HERO_STYLES,
  RADIUS_STYLES,
  DEFAULT_THEME_OPTIONS,
  ACCENT_PRESETS,
  RADIUS_TOKENS,
} from "@/lib/appearance-shared";
export type { Appearance, HeroStyle, RadiusStyle, DefaultTheme } from "@/lib/appearance-shared";

// Root layout runs per request: cached 5min, invalidated via APPEARANCE_TAG on save.
const getCachedAppearance = unstable_cache(
  async (): Promise<Appearance> => {
    const row = await getDb().systemConfig.findUnique({ where: { key: APPEARANCE_KEY } });
    return parseAppearanceJson(row?.value);
  },
  ["appearance-settings"],
  { revalidate: 300, tags: [APPEARANCE_TAG, "settings"] }
);

export async function getAppearance(): Promise<Appearance> {
  try {
    return await getCachedAppearance();
  } catch {
    // Not installed / DB unreachable
    return DEFAULT_APPEARANCE;
  }
}

export async function getAppearanceRaw(): Promise<Appearance> {
  try {
    const row = await getDb().systemConfig.findUnique({ where: { key: APPEARANCE_KEY } });
    return parseAppearanceJson(row?.value);
  } catch {
    return DEFAULT_APPEARANCE;
  }
}
