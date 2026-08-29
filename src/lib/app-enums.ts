// Prisma on SQLite has no native enum; columns are strings, writes gated by zod whitelist, reads narrowed at use site
export const ROLES = ["ADMIN", "EDITOR"] as const;
export type Role = (typeof ROLES)[number];

export const CARD_STATUSES = ["DRAFT", "PUBLISHED"] as const;
export type CardStatus = (typeof CARD_STATUSES)[number];

export const LINK_STATUSES = ["UNKNOWN", "OK", "BROKEN"] as const;
export type LinkStatus = (typeof LINK_STATUSES)[number];

export const ANNOUNCEMENT_TYPES = ["INFO", "SUCCESS", "WARNING", "ERROR"] as const;
export type AnnouncementType = (typeof ANNOUNCEMENT_TYPES)[number];
