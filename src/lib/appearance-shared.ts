// Client-safe appearance types & constants (no db / server imports).
// Server side lives in src/lib/appearance.ts.

export const HERO_STYLES = ["aurora", "grid", "minimal"] as const;
export type HeroStyle = (typeof HERO_STYLES)[number];

export const RADIUS_STYLES = ["sm", "md", "lg", "xl"] as const;
export type RadiusStyle = (typeof RADIUS_STYLES)[number];

export const DEFAULT_THEME_OPTIONS = ["dark", "light"] as const;
export type DefaultTheme = (typeof DEFAULT_THEME_OPTIONS)[number];

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export interface Appearance {
  /** Gradient start (accent-from) */
  accentFrom: string;
  /** Gradient end (accent-to) */
  accentTo: string;
  /** Global corner rounding preset */
  radius: RadiusStyle;
  /** Theme visitors see on first load (localStorage still wins) */
  defaultTheme: DefaultTheme;
  /** Hero background style */
  heroStyle: HeroStyle;
}

export const DEFAULT_APPEARANCE: Appearance = {
  accentFrom: "#8b5cf6",
  accentTo: "#22d3ee",
  radius: "md",
  defaultTheme: "dark",
  heroStyle: "aurora",
};

/** Curated preset palettes for the admin picker */
export const ACCENT_PRESETS: Array<{ name: string; from: string; to: string }> = [
  { name: "Nebula", from: "#8b5cf6", to: "#22d3ee" },
  { name: "Sunset", from: "#f97316", to: "#ec4899" },
  { name: "Aurora", from: "#10b981", to: "#3b82f6" },
  { name: "Ember", from: "#f43f5e", to: "#fb923c" },
  { name: "Indigo", from: "#6366f1", to: "#a855f7" },
  { name: "Ocean", from: "#0ea5e9", to: "#22d3ee" },
  { name: "Lime", from: "#84cc16", to: "#14b8a6" },
  { name: "Royal", from: "#7c3aed", to: "#db2777" },
];

export const RADIUS_TOKENS: Record<RadiusStyle, { card: string; control: string }> = {
  sm: { card: "12px", control: "8px" },
  md: { card: "16px", control: "10px" },
  lg: { card: "20px", control: "13px" },
  xl: { card: "26px", control: "16px" },
};

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && HEX_RE.test(value);
}

export function parseAppearanceJson(raw: string | undefined | null): Appearance {
  if (raw === undefined || raw === null || raw.trim() === "") return DEFAULT_APPEARANCE;
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    return {
      accentFrom: isHexColor(data.accentFrom) ? data.accentFrom : DEFAULT_APPEARANCE.accentFrom,
      accentTo: isHexColor(data.accentTo) ? data.accentTo : DEFAULT_APPEARANCE.accentTo,
      radius: (RADIUS_STYLES as readonly string[]).includes(String(data.radius))
        ? (data.radius as RadiusStyle)
        : DEFAULT_APPEARANCE.radius,
      defaultTheme: (DEFAULT_THEME_OPTIONS as readonly string[]).includes(String(data.defaultTheme))
        ? (data.defaultTheme as DefaultTheme)
        : DEFAULT_APPEARANCE.defaultTheme,
      heroStyle: (HERO_STYLES as readonly string[]).includes(String(data.heroStyle))
        ? (data.heroStyle as HeroStyle)
        : DEFAULT_APPEARANCE.heroStyle,
    };
  } catch {
    return DEFAULT_APPEARANCE;
  }
}
