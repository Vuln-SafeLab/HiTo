import { unstable_cache } from "next/cache";
import {
  isWithinWindow,
  type ActiveAnnouncement,
} from "@/lib/announcements-shared";
import { getDb } from "@/lib/db";

export const ANNOUNCEMENTS_TAG = "announcements";

interface CachedCandidate extends ActiveAnnouncement {
  startAt: string | null;
  endAt: string | null;
}

// Cache only "globally enabled" candidates with window fields; filter by `now` at request time
const getCachedCandidates = unstable_cache(
  async (): Promise<CachedCandidate[]> => {
    const rows = await getDb().announcement.findMany({
      where: { isActive: true },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      take: 20,
      select: {
        id: true,
        content: true,
        linkUrl: true,
        linkText: true,
        type: true,
        isDismissible: true,
        startAt: true,
        endAt: true,
      },
    });
    return rows.map((row) => ({
      id: row.id,
      content: row.content,
      linkUrl: row.linkUrl,
      linkText: row.linkText,
      type: row.type as CachedCandidate["type"],
      isDismissible: row.isDismissible,
      startAt: row.startAt?.toISOString() ?? null,
      endAt: row.endAt?.toISOString() ?? null,
    }));
  },
  ["active-announcements"],
  { revalidate: 60, tags: [ANNOUNCEMENTS_TAG] }
);

export async function getActiveAnnouncement(): Promise<ActiveAnnouncement | null> {
  try {
    const candidates = await getCachedCandidates();
    const now = Date.now();
    const hit = candidates.find((item) => isWithinWindow(item.startAt, item.endAt, now));
    if (hit === undefined) return null;
    return {
      id: hit.id,
      content: hit.content,
      linkUrl: hit.linkUrl,
      linkText: hit.linkText,
      type: hit.type,
      isDismissible: hit.isDismissible,
    };
  } catch {
    return null;
  }
}
