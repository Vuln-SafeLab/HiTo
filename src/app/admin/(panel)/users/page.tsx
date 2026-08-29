import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { AdminUserItem } from "@/components/admin/types";
import { UsersManager } from "@/components/admin/users-manager";
import { requireAdmin } from "@/lib/auth/guard";
import { getDb } from "@/lib/db";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.nav");
  return { title: t("users") };
}

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  // EDITOR access -> HTTP 403
  const current = await requireAdmin();

  const rows = await getDb().user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });

  const users: AdminUserItem[] = rows.map((row) => ({
    id: row.id,
    username: row.username,
    email: row.email,
    role: row.role as AdminUserItem["role"],
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
  }));

  return <UsersManager users={users} currentUserId={current.id} />;
}
