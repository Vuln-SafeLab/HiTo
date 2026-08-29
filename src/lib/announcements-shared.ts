// Pure helpers, zero runtime deps, safe to import from client. (Server-side data source lives in lib/announcements.ts — do not import that from the client.)

export type AnnouncementTone = "INFO" | "SUCCESS" | "WARNING" | "ERROR";

export interface ActiveAnnouncement {
  id: string;
  content: string;
  linkUrl: string | null;
  linkText: string | null;
  type: AnnouncementTone;
  isDismissible: boolean;
}

export function isWithinWindow(
  startAt: string | Date | null,
  endAt: string | Date | null,
  at: number
): boolean {
  const start = startAt === null ? null : new Date(startAt).getTime();
  const end = endAt === null ? null : new Date(endAt).getTime();
  return (start === null || start <= at) && (end === null || end >= at);
}
