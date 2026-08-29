import { Compass } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function NotFoundPage() {
  const t = await getTranslations("common");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 py-10 text-center">
      <Compass className="size-10 text-faint" aria-hidden="true" />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("notFoundTitle")}</h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">{t("notFoundBody")}</p>
      </div>
      <Button variant="outline" asChild>
        <Link href="/">{t("backHome")}</Link>
      </Button>
      <p className="mt-6 text-xs text-faint">由 VulnLab 提供技术支持</p>
    </main>
  );
}
