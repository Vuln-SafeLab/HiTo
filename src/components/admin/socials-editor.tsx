"use client";

import { useState } from "react";
import { GripVertical, Loader2, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SocialIcon } from "@/components/shared/social-icons";
import { updateSocialsAction } from "@/lib/actions/settings";
import { SOCIAL_PLATFORMS, type SocialLink } from "@/lib/socials";
import { errorKeyFor } from "./utils";

function placeholderFor(platform: string): string {
  return SOCIAL_PLATFORMS.find((p) => p.id === platform)?.placeholder ?? "https://…";
}

export function SocialsEditor({ initial }: { initial: SocialLink[] }) {
  const t = useTranslations();
  const router = useRouter();
  const [links, setLinks] = useState<SocialLink[]>(initial);
  const [saving, setSaving] = useState(false);

  function addLink(): void {
    const used = new Set(links.map((l) => l.platform));
    const next = SOCIAL_PLATFORMS.find((p) => !used.has(p.id))?.id ?? "website";
    setLinks((prev) => [...prev, { platform: next, url: "" }]);
  }

  function updateLink(index: number, patch: Partial<SocialLink>): void {
    setLinks((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function removeLink(index: number): void {
    setLinks((prev) => prev.filter((_, i) => i !== index));
  }

  async function save(): Promise<void> {
    const payload = links.filter((l) => l.url.trim() !== "").map((l) => ({ ...l, url: l.url.trim() }));
    setSaving(true);
    const outcome = await updateSocialsAction(payload);
    setSaving(false);
    if (outcome.ok) {
      setLinks(payload);
      toast.success(t("admin.settings.saved"));
      router.refresh();
    } else {
      toast.error(t(errorKeyFor(outcome.code)));
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-card border border-border bg-card p-6">
      <div>
        <h2 className="text-sm font-semibold">{t("admin.settings.socials")}</h2>
        <p className="mt-1 text-xs text-faint">{t("admin.settings.socialsHint")}</p>
      </div>

      <div className="flex flex-col gap-2">
        {links.length === 0 && (
          <p className="rounded-control border border-dashed border-border px-4 py-6 text-center text-sm text-faint">
            {t("admin.settings.socialsEmpty")}
          </p>
        )}
        {links.map((link, index) => (
          <div key={index} className="flex items-center gap-2">
            <span className="text-faint">
              <GripVertical className="size-4" aria-hidden="true" />
            </span>
            <div className="flex size-9 shrink-0 items-center justify-center rounded-control border border-border bg-surface text-muted-foreground">
              <SocialIcon platform={link.platform} className="size-4" />
            </div>
            <Select
              value={link.platform}
              onValueChange={(value) => updateLink(index, { platform: value })}
            >
              <SelectTrigger className="w-44 shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SOCIAL_PLATFORMS.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <span className="flex items-center gap-2">
                      <SocialIcon platform={p.id} className="size-4" />
                      {p.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={link.url}
              onChange={(event) => updateLink(index, { url: event.target.value })}
              placeholder={placeholderFor(link.platform)}
              className="flex-1"
              aria-label={t("common.url")}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t("common.delete")}
              onClick={() => removeLink(index)}
            >
              <Trash2 className="size-4 text-destructive" aria-hidden="true" />
            </Button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <Button type="button" variant="outline" onClick={addLink}>
          <Plus className="size-4" aria-hidden="true" />
          {t("admin.settings.addSocial")}
        </Button>
        <Button type="button" variant="gradient" onClick={() => void save()} disabled={saving}>
          {saving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {saving ? t("common.saving") : t("common.save")}
        </Button>
      </div>
    </div>
  );
}
