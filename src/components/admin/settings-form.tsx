"use client";

import { useMemo, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { ImagePlus, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { FieldError } from "@/components/setup/field-error";
import { updateSettingsAction } from "@/lib/actions/settings";
import { settingsFormSchema, type SettingsFormInput } from "@/lib/validators/content";
import { errorKeyFor } from "./utils";

export function SettingsForm({ initial }: { initial: SettingsFormInput }) {
  const t = useTranslations();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  const schema = useMemo(() => settingsFormSchema((key, values) => t(key, values)), [t]);
  const form = useForm<SettingsFormInput>({
    resolver: zodResolver(schema),
    defaultValues: initial,
  });

  async function uploadLogo(file: File): Promise<void> {
    setUploading(true);
    const body = new FormData();
    body.append("file", file);
    try {
      const response = await fetch("/api/upload", { method: "POST", body });
      const data: unknown = await response.json();
      if (
        typeof data === "object" &&
        data !== null &&
        (data as { ok?: unknown }).ok === true &&
        typeof (data as { url?: unknown }).url === "string"
      ) {
        form.setValue("logo", (data as { url: string }).url, { shouldDirty: true });
      } else {
        const code =
          typeof data === "object" && data !== null && "code" in data
            ? String((data as { code: unknown }).code)
            : "generic";
        toast.error(
          code === "uploadSize"
            ? t("errors.uploadSize", { max: 2 })
            : t(errorKeyFor(code === "uploadType" ? "generic" : code))
        );
        if (code === "uploadType") toast.error(t("errors.uploadType"));
      }
    } catch {
      toast.error(t("errors.generic"));
    }
    setUploading(false);
  }

  async function submit(values: SettingsFormInput): Promise<void> {
    setSubmitting(true);
    const outcome = await updateSettingsAction(values);
    setSubmitting(false);
    if (outcome.ok) {
      toast.success(t("admin.settings.saved"));
      router.refresh();
    } else {
      toast.error(t(errorKeyFor(outcome.code)));
    }
  }

  const logo = form.watch("logo");

  return (
    <form
      className="flex flex-col gap-5 rounded-card border border-border bg-card p-6"
      onSubmit={(event) => void form.handleSubmit(submit)(event)}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="set-name">{t("admin.settings.siteName")}</Label>
        <Input id="set-name" {...form.register("siteName")} />
        <FieldError message={form.formState.errors.siteName?.message} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>{t("admin.settings.logo")}</Label>
        <div className="flex items-center gap-3">
          {logo !== "" && (
            <Image
              src={logo}
              alt=""
              width={36}
              height={36}
              unoptimized
              className="size-9 rounded border border-border object-cover"
            />
          )}
          <Button
            type="button"
            variant="outline"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <ImagePlus className="size-4" aria-hidden="true" />
            )}
            {t("admin.settings.logo")}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/x-icon"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file !== undefined) void uploadLogo(file);
              event.target.value = "";
            }}
          />
        </div>
        <FieldError message={form.formState.errors.logo?.message} />
      </div>

      <div className="flex items-start justify-between gap-4 rounded-control border border-border bg-surface px-4 py-3">
        <div>
          <p className="text-sm font-medium">{t("admin.settings.maintenance")}</p>
          <p className="mt-0.5 text-xs text-faint">{t("admin.settings.maintenanceHint")}</p>
        </div>
        <Switch
          checked={form.watch("maintenance")}
          onCheckedChange={(checked) =>
            form.setValue("maintenance", checked, { shouldDirty: true })
          }
          aria-label={t("admin.settings.maintenance")}
        />
      </div>

      <div>
        <Button type="submit" variant="gradient" disabled={submitting}>
          {submitting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {submitting ? t("common.saving") : t("common.save")}
        </Button>
      </div>
    </form>
  );
}
