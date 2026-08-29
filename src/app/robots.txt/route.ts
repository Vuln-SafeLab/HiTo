import { DEFAULT_ROBOTS_TXT, getSeoSettings } from "@/lib/settings";
import { getEnv } from "@/lib/env";

// Route Handler (not MetadataRoute.Robots) because the admin edits arbitrary text.
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const seo = await getSeoSettings();
  const base = getEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, "");

  let body: string;
  if (seo.noindex) {
    // noindex overrides custom content but keeps sitemap declaration
    body = "User-agent: *\nDisallow: /\n";
  } else {
    body = seo.robotsTxt ?? DEFAULT_ROBOTS_TXT;
    if (!body.endsWith("\n")) body += "\n";
  }
  body += `\nSitemap: ${base}/sitemap.xml\n`;

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
