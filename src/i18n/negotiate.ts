import { defaultLocale, locales, type Locale } from "@/i18n/config";

interface LanguageRange {
  tag: string;
  quality: number;
}

function parseAcceptLanguage(header: string): LanguageRange[] {
  return header
    .split(",")
    .map((part): LanguageRange | null => {
      const [rawTag, ...params] = part.trim().split(";");
      const tag = (rawTag ?? "").trim().toLowerCase();
      if (tag === "") return null;
      let quality = 1;
      for (const param of params) {
        const [key, value] = param.trim().split("=");
        if (key === "q" && value !== undefined) {
          const parsed = Number.parseFloat(value);
          if (!Number.isNaN(parsed)) quality = parsed;
        }
      }
      return { tag, quality };
    })
    .filter((range): range is LanguageRange => range !== null && range.quality > 0)
    .sort((a, b) => b.quality - a.quality);
}

// Server-side Accept-Language negotiation: full tag -> language prefix (zh-TW/zh-HK -> zh-CN)
export function matchLocale(header: string | null): Locale {
  if (header === null || header.trim() === "") return defaultLocale;

  for (const { tag } of parseAcceptLanguage(header)) {
    const exact = locales.find((locale) => locale.toLowerCase() === tag);
    if (exact) return exact;

    const prefix = tag.split("-")[0] ?? tag;
    if (prefix === "zh") return "zh-CN";
    const byPrefix = locales.find((locale) => locale.toLowerCase().split("-")[0] === prefix);
    if (byPrefix) return byPrefix;
  }
  return defaultLocale;
}
