// Social links live in SystemConfig.site.socials (JSON array) — no new table means no migration
// The platform whitelist powers admin dropdown, public icon rendering, and server-side validation

export interface SocialLink {
  platform: string;
  url: string;
}

export const SOCIAL_PLATFORMS = [
  { id: "x", label: "X (Twitter)", placeholder: "https://x.com/yourname" },
  { id: "instagram", label: "Instagram", placeholder: "https://instagram.com/yourname" },
  { id: "github", label: "GitHub", placeholder: "https://github.com/yourname" },
  { id: "youtube", label: "YouTube", placeholder: "https://youtube.com/@yourname" },
  { id: "telegram", label: "Telegram", placeholder: "https://t.me/yourname" },
  { id: "discord", label: "Discord", placeholder: "https://discord.gg/xxxx" },
  { id: "facebook", label: "Facebook", placeholder: "https://facebook.com/yourname" },
  { id: "linkedin", label: "LinkedIn", placeholder: "https://linkedin.com/in/yourname" },
  { id: "tiktok", label: "TikTok / 抖音", placeholder: "https://tiktok.com/@yourname" },
  { id: "wechat", label: "WeChat / 微信", placeholder: "https://... 或公众号链接" },
  { id: "weibo", label: "Weibo / 微博", placeholder: "https://weibo.com/yourname" },
  { id: "bilibili", label: "Bilibili / 哔哩哔哩", placeholder: "https://space.bilibili.com/xxxx" },
  { id: "email", label: "Email", placeholder: "mailto:you@example.com" },
  { id: "website", label: "Website / 官网", placeholder: "https://your-site.com" },
] as const;

export const SOCIAL_PLATFORM_IDS: readonly string[] = SOCIAL_PLATFORMS.map((p) => p.id);

const URL_RE = /^(https?:\/\/|mailto:).+/i;

export function isValidSocial(link: SocialLink): boolean {
  return SOCIAL_PLATFORM_IDS.includes(link.platform) && URL_RE.test(link.url) && link.url.length <= 2048;
}

export function parseSocials(raw: string | null | undefined): SocialLink[] {
  if (raw === null || raw === undefined || raw.trim() === "") return [];
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    const result: SocialLink[] = [];
    for (const item of data) {
      if (
        typeof item === "object" &&
        item !== null &&
        typeof (item as SocialLink).platform === "string" &&
        typeof (item as SocialLink).url === "string"
      ) {
        const link: SocialLink = {
          platform: (item as SocialLink).platform,
          url: (item as SocialLink).url,
        };
        if (isValidSocial(link)) result.push(link);
      }
      if (result.length >= 20) break;
    }
    return result;
  } catch {
    return [];
  }
}
