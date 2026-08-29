// Serialized types passed from admin server pages to client managers (zero runtime deps; safe to import on the client)

export interface AdminCategory {
  id: string;
  slug: string;
  name: string;
  icon: string;
  description: string | null;
  cardCount: number;
}

export interface AdminCard {
  id: string;
  title: string;
  url: string;
  description: string | null;
  favicon: string | null;
  image: string | null;
  categoryId: string;
  status: "DRAFT" | "PUBLISHED";
  featured: boolean;
  clickCount: number;
  linkStatus: "UNKNOWN" | "OK" | "BROKEN";
  lastCheckedAt: string | null;
  updatedAt: string;
  tags: string[];
}

export interface TrashCardItem {
  id: string;
  title: string;
  url: string;
  categoryName: string;
  deletedAt: string;
}

export interface TrashCategoryItem {
  id: string;
  name: string;
  slug: string;
  deletedAt: string;
}

export interface AdminUserItem {
  id: string;
  username: string;
  email: string;
  role: "ADMIN" | "EDITOR";
  isActive: boolean;
  createdAt: string;
}

export interface SessionItem {
  id: string;
  username: string;
  ip: string;
  userAgent: string;
  createdAt: string;
  lastUsedAt: string;
  isCurrent: boolean;
}

export interface IpBanItem {
  id: string;
  ip: string;
  reason: string | null;
  createdBy: string;
  createdAt: string;
  expiresAt: string | null;
}

export interface AuditLogItem {
  id: string;
  username: string;
  action: string;
  targetType: string;
  targetId: string | null;
  detail: string | null;
  ip: string;
  userAgent: string;
  createdAt: string;
}

export interface AdminAnnouncementItem {
  id: string;
  content: string;
  linkUrl: string | null;
  linkText: string | null;
  type: "INFO" | "SUCCESS" | "WARNING" | "ERROR";
  startAt: string | null;
  endAt: string | null;
  isActive: boolean;
  isDismissible: boolean;
  priority: number;
  updatedAt: string;
}

export interface BackupItem {
  id: string;
  filename: string;
  sizeBytes: number;
  itemCount: number;
  createdBy: string;
  createdAt: string;
}

export type AdPositionEnum =
  | "HEADER"
  | "FOOTER"
  | "ARTICLE_TOP"
  | "ARTICLE_BOTTOM"
  | "SIDEBAR"
  | "POPUP"
  | "INLINE";
export type AdTypeEnum = "SCRIPT" | "HTML" | "IMAGE" | "IFRAME";
export type AdDeviceEnum = "ALL" | "DESKTOP" | "MOBILE";

export interface AdminAdItem {
  id: string;
  provider: string;
  alias: string;
  position: AdPositionEnum;
  type: AdTypeEnum;
  device: AdDeviceEnum;
  code: string;
  isActive: boolean;
  weight: number;
  startAt: string | null;
  endAt: string | null;
  updatedAt: string;
}

export interface AdminAdVerificationItem {
  id: string;
  provider: string;
  metaName: string | null;
  metaContent: string | null;
  fileName: string | null;
  fileContent: string | null;
  dnsType: string | null;
  dnsHost: string | null;
  dnsValue: string | null;
  dnsNote: string | null;
  isActive: boolean;
  updatedAt: string;
}

export interface WafEventItem {
  id: number;
  eventId: string;
  at: string;
  ruleId: string;
  action: string; // log | block | challenge | ban
  ip: string;
  path: string;
  method: string;
  ua: string;
  sample: string | null;
  count: number;
  acknowledgedAt: string | null;
}

export interface KunBanEntryView {
  ipKey: string;
  bannedUntil: number;
  strikes: number;
}