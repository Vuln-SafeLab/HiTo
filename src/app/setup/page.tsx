import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { SetupWizard } from "@/components/setup/setup-wizard";
import { isInstalled } from "@/lib/setup/state";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("setup");
  return { title: t("title") };
}

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  // Second gate outside middleware: even if the route layer is bypassed, the page itself rejects installed state.
  if (await isInstalled()) {
    redirect("/");
  }

  return (
    <main className="flex min-h-screen items-start justify-center px-4 py-12 sm:py-16">
      <div className="w-full max-w-xl">
        <SetupWizard />
      </div>
    </main>
  );
}
