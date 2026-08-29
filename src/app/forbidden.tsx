import { ShieldX } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";

// Rendered when requireAdmin() triggers forbidden() (HTTP 403)
export default async function ForbiddenPage() {
  const t = await getTranslations();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 py-10 text-center">
      <ShieldX className="size-10 text-destructive" aria-hidden="true" />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">403</h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">{t("errors.forbidden")}</p>
      </div>
      <Button variant="outline" asChild>
        <Link href="/admin">{t("common.backHome")}</Link>
      </Button>
      <p className="mt-6 text-xs text-faint">由 VulnLab 提供技术支持</p>
    </main>
  );
}
