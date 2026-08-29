import { pinnedFetch, resolvePublicHttpTarget } from "@/lib/metadata-fetch";

export interface LinkCheckResult {
  id: string;
  ok: boolean;
}

const PROBE_TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 5;
const CONCURRENCY = 5;

async function probe(url: string): Promise<boolean> {
  for (const method of ["HEAD", "GET"] as const) {
    let current: URL;
    try {
      current = new URL(url);
    } catch {
      return false;
    }
    let reachable = false;
    let hop = 0;
    for (; hop <= MAX_REDIRECTS; hop++) {
      const target = await resolvePublicHttpTarget(current);
      if (target === null) return false;
      const response = await pinnedFetch(current, target.ip, target.port, {
        method,
        timeoutMs: PROBE_TIMEOUT_MS,
        maxBytes: 0,
        userAgent: "Mozilla/5.0 (compatible; HiToBot/1.0; +link-check)",
      });
      if (response === null) break;
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.location;
        if (location === null) break;
        try {
          current = new URL(location, current);
        } catch {
          return false;
        }
        continue;
      }
      reachable = response.status < 400;
      break;
    }
    if (reachable) return true;
    // Fall back to GET if HEAD is rejected (405/403)
  }
  return false;
}

export async function checkCardLinks(
  cards: Array<{ id: string; url: string }>
): Promise<LinkCheckResult[]> {
  const results: LinkCheckResult[] = [];
  let cursor = 0;

  async function worker(): Promise<void> {
    for (;;) {
      const index = cursor;
      cursor += 1;
      const card = cards[index];
      if (card === undefined) return;
      results.push({ id: card.id, ok: await probe(card.url) });
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, cards.length) }, () => worker())
  );
  return results;
}
