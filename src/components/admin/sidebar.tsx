"use client";

import type { Role } from "@/lib/app-enums";
import {
  CircleDollarSign,
  DatabaseBackup,
  FileCheck2,
  FolderTree,
  LayoutDashboard,
  Megaphone,
  Palette,
  Settings2,
  ShieldCheck,
  SquareStack,
  Trash2,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  key:
    | "dashboard"
    | "cards"
    | "categories"
    | "trash"
    | "data"
    | "announcements"
    | "ads"
    | "adVerify"
    | "users"
    | "settings"
    | "appearance"
    | "security";
  icon: LucideIcon;
  adminOnly?: boolean;
}

export const ADMIN_NAV_ITEMS: NavItem[] = [
  { href: "/admin", key: "dashboard", icon: LayoutDashboard },
  { href: "/admin/cards", key: "cards", icon: SquareStack },
  { href: "/admin/categories", key: "categories", icon: FolderTree },
  { href: "/admin/trash", key: "trash", icon: Trash2 },
  { href: "/admin/data", key: "data", icon: DatabaseBackup },
  // server-side requireAdmin still enforces; this is nav layer only
  { href: "/admin/announcements", key: "announcements", icon: Megaphone, adminOnly: true },
  { href: "/admin/ads", key: "ads", icon: CircleDollarSign, adminOnly: true },
  { href: "/admin/ads/verifications", key: "adVerify", icon: FileCheck2, adminOnly: true },
  { href: "/admin/users", key: "users", icon: Users, adminOnly: true },
  { href: "/admin/settings", key: "settings", icon: Settings2, adminOnly: true },
  { href: "/admin/appearance", key: "appearance", icon: Palette, adminOnly: true },
  { href: "/admin/security", key: "security", icon: ShieldCheck, adminOnly: true },
];

export function Sidebar({ role }: { role: Role }) {
  const t = useTranslations();
  const pathname = usePathname();

  const items = ADMIN_NAV_ITEMS.filter((item) => item.adminOnly !== true || role === "ADMIN");

  return (
    <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-border bg-surface p-3 md:flex">
      <Link
        href="/"
        className="mb-4 flex items-center gap-2 rounded-control px-2 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="bg-accent-gradient bg-clip-text text-base font-semibold tracking-tight text-transparent">
          {t("common.appName")}
        </span>
      </Link>
      <nav className="flex flex-1 flex-col gap-0.5">
        {items.map((item) => {
          // /admin/ads is a prefix of /admin/ads/verifications: use exact match to avoid both highlighting
          const isActive =
            item.href === "/admin"
              ? pathname === "/admin"
              : item.href === "/admin/ads"
                ? pathname === "/admin/ads"
                : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-control px-2.5 py-2 text-sm transition-colors duration-150",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isActive
                  ? "bg-surface-2 font-medium text-foreground"
                  : "text-muted-foreground hover:bg-surface-2 hover:text-foreground"
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              {t(`admin.nav.${item.key}`)}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
