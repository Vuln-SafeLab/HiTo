import { unstable_cache } from "next/cache";
import { getDb } from "@/lib/db";
import type { AdPositionValue, AdDeviceValue } from "@/lib/validators/ads";

export const ADS_TAG = "ads";

export interface RenderableAd {
  id: string;
  position: AdPositionValue;
  type: "SCRIPT" | "HTML" | "IMAGE" | "IFRAME";
  code: string;
}

interface CachedAd {
  id: string;
  position: AdPositionValue;
  type: CachedAdType;
  device: AdDeviceValue;
  code: string;
  startAt: string | null;
  endAt: string | null;
}

type CachedAdType = "SCRIPT" | "HTML" | "IMAGE" | "IFRAME";

const getCachedActiveAds = unstable_cache(
  async (): Promise<CachedAd[]> => {
    const rows = await getDb().advertisement.findMany({
      where: { isActive: true },
      orderBy: [{ weight: "desc" }, { createdAt: "asc" }],
      take: 200,
      select: {
        id: true,
        position: true,
        type: true,
        device: true,
        code: true,
        startAt: true,
        endAt: true,
      },
    });
    return rows.map((row) => ({
      id: row.id,
      position: row.position as CachedAd["position"],
      type: row.type as CachedAd["type"],
      device: row.device as CachedAd["device"],
      code: row.code,
      startAt: row.startAt?.toISOString() ?? null,
      endAt: row.endAt?.toISOString() ?? null,
    }));
  },
  ["active-ads"],
  { revalidate: 60, tags: [ADS_TAG] }
);

export function detectDevice(userAgent: string): Exclude<AdDeviceValue, "ALL"> {
  return /mobile|android|iphone|ipod|phone/i.test(userAgent) ? "MOBILE" : "DESKTOP";
}

function withinWindow(startAt: string | null, endAt: string | null, now: number): boolean {
  if (startAt !== null && new Date(startAt).getTime() > now) return false;
  if (endAt !== null && new Date(endAt).getTime() < now) return false;
  return true;
}

function matchesDevice(adDevice: AdDeviceValue, device: Exclude<AdDeviceValue, "ALL">): boolean {
  return adDevice === "ALL" || adDevice === device;
}

export async function getAdsForPosition(
  position: AdPositionValue,
  device: Exclude<AdDeviceValue, "ALL">
): Promise<RenderableAd[]> {
  try {
    const all = await getCachedActiveAds();
    const now = Date.now();
    return all
      .filter((ad) => ad.position === position && withinWindow(ad.startAt, ad.endAt, now))
      .filter((ad) => matchesDevice(ad.device, device))
      .map((ad) => ({ id: ad.id, position: ad.position, type: ad.type, code: ad.code }));
  } catch {
    return [];
  }
}

export interface VerificationMeta {
  name: string;
  content: string;
}

const getCachedVerificationMetas = unstable_cache(
  async (): Promise<VerificationMeta[]> => {
    const rows = await getDb().adVerification.findMany({
      where: { isActive: true, metaName: { not: null }, metaContent: { not: null } },
      orderBy: { createdAt: "asc" },
      select: { metaName: true, metaContent: true },
    });
    return rows.map((row) => ({ name: row.metaName ?? "", content: row.metaContent ?? "" }));
  },
  ["ad-verification-metas"],
  { revalidate: 60, tags: [ADS_TAG] }
);

export async function getAdVerificationMetas(): Promise<VerificationMeta[]> {
  try {
    return await getCachedVerificationMetas();
  } catch {
    return [];
  }
}

interface FileHit {
  content: string;
}

const getCachedFileVerifications = unstable_cache(
  async (): Promise<Record<string, FileHit>> => {
    const rows = await getDb().adVerification.findMany({
      where: { isActive: true, fileName: { not: null }, fileContent: { not: null } },
      select: { fileName: true, fileContent: true },
    });
    const map: Record<string, FileHit> = {};
    for (const row of rows) {
      map[(row.fileName ?? "").toLowerCase()] = { content: row.fileContent ?? "" };
    }
    return map;
  },
  ["ad-verification-files"],
  { revalidate: 60, tags: [ADS_TAG] }
);

export async function getVerificationFile(fileName: string): Promise<FileHit | null> {
  if (fileName === "" || fileName.length > 120 || fileName.includes("..")) return null;
  try {
    const map = await getCachedFileVerifications();
    return map[fileName.toLowerCase()] ?? null;
  } catch {
    return null;
  }
}
