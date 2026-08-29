// Static command palette registry; labelKey resolved via t(); keywords are match aliases (English/pinyin), not UI copy

import {
  ExternalLink,
  FolderPlus,
  LogOut,
  Megaphone,
  Moon,
  Plus,
  type LucideIcon,
} from "lucide-react";
import { ADMIN_NAV_ITEMS } from "@/components/admin/sidebar";

export type CommandActionId = "logout" | "toggleTheme" | "openSite";

export interface CommandEntry {
  id: string;
  labelKey: string;
  keywords: string[];
  icon: LucideIcon;
  group: "pages" | "actions";
  adminOnly?: boolean;
  href?: string;
  actionId?: CommandActionId;
}

const NAV_KEYWORDS: Record<string, string[]> = {
  dashboard: ["dashboard", "overview", "yibiaopan", "gailan", "shouye"],
  cards: ["cards", "links", "kapian", "lianjie"],
  categories: ["categories", "fenlei"],
  trash: ["trash", "recycle", "huishouzhan"],
  data: ["data", "import", "export", "shuju", "daoru", "daochu", "beifen"],
  announcements: ["announcements", "banner", "notice", "gonggao", "hengfu"],
  ads: ["ads", "advertising", "ad", "guanggao", "taoguang", "lianneng"],
  adVerify: ["verify", "verification", "site verification", "yanzheng", "quanyan", "siterown"],
  users: ["users", "members", "chengyuan", "yonghu", "guanliyuan"],
  settings: ["settings", "shezhi", "zhandianshezhi", "seo"],
  appearance: ["appearance", "theme", "style", "colors", "waiguan", "yangshi", "zhuti", "yanshi", "fengge"],
  security: ["security", "audit", "anquan", "anquanzhongxin", "shenji"],
};

const PAGE_ENTRIES: CommandEntry[] = ADMIN_NAV_ITEMS.map((item) => ({
  id: `page:${item.key}`,
  labelKey: `admin.nav.${item.key}`,
  keywords: NAV_KEYWORDS[item.key] ?? [],
  icon: item.icon,
  group: "pages",
  adminOnly: item.adminOnly,
  href: item.href,
}));

const ACTION_ENTRIES: CommandEntry[] = [
  {
    id: "action:new-card",
    labelKey: "admin.cmdk.newCard",
    keywords: ["new card", "add link", "create", "xinzeng", "xinjiankapian", "tianjialianjie"],
    icon: Plus,
    group: "actions",
    href: "/admin/cards?new=1",
  },
  {
    id: "action:new-category",
    labelKey: "admin.cmdk.newCategory",
    keywords: ["new category", "xinjianfenlei"],
    icon: FolderPlus,
    group: "actions",
    href: "/admin/categories?new=1",
  },
  {
    id: "action:new-announcement",
    labelKey: "admin.cmdk.newAnnouncement",
    keywords: ["new announcement", "xinjiangonggao", "gonggao"],
    icon: Megaphone,
    group: "actions",
    adminOnly: true,
    href: "/admin/announcements?new=1",
  },
  {
    id: "action:toggle-theme",
    labelKey: "admin.cmdk.toggleTheme",
    keywords: ["theme", "dark", "light", "zhuti", "qiehuanzhuti", "shensemoshi"],
    icon: Moon,
    group: "actions",
    actionId: "toggleTheme",
  },
  {
    id: "action:open-site",
    labelKey: "admin.cmdk.goHome",
    keywords: ["home", "site", "public", "qiantai", "dakaiqiantai", "wangzhan"],
    icon: ExternalLink,
    group: "actions",
    actionId: "openSite",
  },
  {
    id: "action:logout",
    labelKey: "common.logout",
    keywords: ["logout", "sign out", "exit", "tuichu", "tuichudenglu", "zhuxiao"],
    icon: LogOut,
    group: "actions",
    actionId: "logout",
  },
];

export const COMMAND_REGISTRY: CommandEntry[] = [...PAGE_ENTRIES, ...ACTION_ENTRIES];

export interface CommandSearchResult {
  cards: Array<{ id: string; title: string; url: string }>;
  categories: Array<{ id: string; name: string; slug: string }>;
  tags: Array<{ id: string; name: string }>;
}
