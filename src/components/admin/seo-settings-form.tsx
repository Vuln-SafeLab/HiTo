"use client";

import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { FieldError } from "@/components/setup/field-error";
import { updateSeoSettingsAction } from "@/lib/actions/settings";
import {
  seoSettingsFormSchema,
  type SeoSettingsFormInput,
} from "@/lib/validators/content";
import { errorKeyFor } from "./utils";

export function SeoSettingsForm({ initial }: { initial: SeoSettingsFormInput }) {
  const t = useTranslations();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const schema = useMemo(() => seoSettingsFormSchema((key, values) => t(key, values)), [t]);
  const form = useForm<SeoSettingsFormInput>({
    resolver: zodResolver(schema),
    defaultValues: initial,
  });

  async function submit(values: SeoSettingsFormInput): Promise<void> {
    setSubmitting(true);
    const outcome = await updateSeoSettingsAction(values);
    setSubmitting(false);
    if (outcome.ok) {
      toast.success(t("admin.settings.saved"));
      router.refresh();
    } else {
      toast.error(t(errorKeyFor(outcome.code)));
    }
  }

  return (
    <form
      className="flex flex-col gap-5 rounded-card border border-border bg-card p-6"
      onSubmit={(event) => void form.handleSubmit(submit)(event)}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="seo-title">{t("admin.settings.seoTitle")}</Label>
          <Input id="seo-title" {...form.register("seoTitle")} />
          <FieldError message={form.formState.errors.seoTitle?.message} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="seo-template">{t("admin.settings.titleTemplate")}</Label>
          <Input id="seo-template" placeholder="%s · HiTo" {...form.register("titleTemplate")} />
          <p className="text-xs text-faint">{t("admin.settings.titleTemplateHint")}</p>
          <FieldError message={form.formState.errors.titleTemplate?.message} />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="seo-desc">{t("admin.settings.seoDescription")}</Label>
        <Textarea id="seo-desc" rows={2} {...form.register("seoDescription")} />
        <FieldError message={form.formState.errors.seoDescription?.message} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="seo-keywords">{t("admin.settings.keywords")}</Label>
          <Input id="seo-keywords" placeholder="nav, tools, directory" {...form.register("keywords")} />
          <FieldError message={form.formState.errors.keywords?.message} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>{t("admin.settings.twitterCard")}</Label>
          <Select
            value={form.watch("twitterCard")}
            onValueChange={(value) =>
              form.setValue(
                "twitterCard",
                value === "summary" ? "summary" : "summary_large_image",
                { shouldDirty: true }
              )
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="summary_large_image">summary_large_image</SelectItem>
              <SelectItem value="summary">summary</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="seo-og">{t("admin.settings.ogImage")}</Label>
        <Input id="seo-og" placeholder="https://…/og.png" {...form.register("ogImage")} />
        <FieldError message={form.formState.errors.ogImage?.message} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="seo-vg">{t("admin.settings.verifyGoogle")}</Label>
          <Input id="seo-vg" {...form.register("verifyGoogle")} />
          <FieldError message={form.formState.errors.verifyGoogle?.message} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="seo-vb">{t("admin.settings.verifyBing")}</Label>
          <Input id="seo-vb" {...form.register("verifyBing")} />
          <FieldError message={form.formState.errors.verifyBing?.message} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="seo-vbd">{t("admin.settings.verifyBaidu")}</Label>
          <Input id="seo-vbd" {...form.register("verifyBaidu")} />
          <FieldError message={form.formState.errors.verifyBaidu?.message} />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="seo-robots">{t("admin.settings.robotsTxt")}</Label>
        <Textarea
          id="seo-robots"
          rows={7}
          className="font-mono text-xs"
          {...form.register("robotsTxt")}
        />
        <p className="text-xs text-faint">{t("admin.settings.robotsTxtHint")}</p>
        <FieldError message={form.formState.errors.robotsTxt?.message} />
      </div>

      <div className="flex items-start justify-between gap-4 rounded-control border border-border bg-surface px-4 py-3">
        <div>
          <p className="text-sm font-medium text-destructive">{t("admin.settings.noindex")}</p>
          <p className="mt-0.5 text-xs text-faint">{t("admin.settings.noindexHint")}</p>
        </div>
        <Switch
          checked={form.watch("noindex")}
          onCheckedChange={(checked) => form.setValue("noindex", checked, { shouldDirty: true })}
          aria-label={t("admin.settings.noindex")}
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
