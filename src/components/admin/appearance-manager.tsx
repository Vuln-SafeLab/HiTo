"use client";

import { useMemo, useState } from "react";
import { Check, Loader2, Palette, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { updateAppearanceAction } from "@/lib/actions/appearance";
import {
  ACCENT_PRESETS,
  RADIUS_TOKENS,
  RADIUS_STYLES,
  HERO_STYLES,
  DEFAULT_THEME_OPTIONS,
  type Appearance,
} from "@/lib/appearance-shared";
import { errorKeyFor } from "./utils";

const STAR = "M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17l-6.1 3.6 1.4-6.8L2.2 9.1l6.9-.8z";

function isHex(v: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(v);
}

export function AppearanceManager({ initial }: { initial: Appearance }) {
  const t = useTranslations();
  const router = useRouter();
  const [value, setValue] = useState<Appearance>(initial);
  const [saving, setSaving] = useState(false);
  const dirty = useMemo(() => JSON.stringify(value) !== JSON.stringify(initial), [value, initial]);

  const radius = RADIUS_TOKENS[value.radius];
  const previewVars = {
    "--accent-from": value.accentFrom,
    "--accent-to": value.accentTo,
    "--radius-card": radius.card,
    "--radius-control": radius.control,
  } as React.CSSProperties;

  async function save(): Promise<void> {
    if (!isHex(value.accentFrom) || !isHex(value.accentTo)) {
      toast.error(t("validation.required"));
      return;
    }
    setSaving(true);
    const outcome = await updateAppearanceAction(value);
    setSaving(false);
    if (outcome.ok) {
      toast.success(t("admin.settings.saved"));
      router.refresh();
    } else {
      toast.error(t(errorKeyFor(outcome.code)));
    }
  }

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_minmax(320px,420px)]">
      {/* ── Controls ── */}
      <div className="flex flex-col gap-5">
        {/* Accent presets */}
        <section className="rounded-card border border-border bg-card p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Palette className="size-4 text-gradient-from" aria-hidden="true" />
            {t("admin.appearance.accent")}
          </h2>
          <div className="flex flex-wrap gap-2.5">
            {ACCENT_PRESETS.map((p) => {
              const active =
                value.accentFrom.toLowerCase() === p.from.toLowerCase() &&
                value.accentTo.toLowerCase() === p.to.toLowerCase();
              return (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => setValue((v) => ({ ...v, accentFrom: p.from, accentTo: p.to }))}
                  title={p.name}
                  aria-pressed={active}
                  className={cn(
                    "group relative size-14 overflow-hidden rounded-control border transition-transform duration-150 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active ? "border-foreground" : "border-border"
                  )}
                  style={{ backgroundImage: `linear-gradient(135deg, ${p.from}, ${p.to})` }}
                >
                  {active && (
                    <Check className="absolute inset-0 m-auto size-5 text-white drop-shadow" aria-hidden="true" />
                  )}
                </button>
              );
            })}
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="accent-from">{t("admin.appearance.accentFrom")}</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={isHex(value.accentFrom) ? value.accentFrom : "#000000"}
                  onChange={(e) => setValue((v) => ({ ...v, accentFrom: e.target.value }))}
                  aria-label={t("admin.appearance.accentFrom")}
                  className="size-9 cursor-pointer rounded-control border border-border bg-transparent p-1"
                />
                <Input
                  id="accent-from"
                  className="font-mono"
                  value={value.accentFrom}
                  onChange={(e) => setValue((v) => ({ ...v, accentFrom: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="accent-to">{t("admin.appearance.accentTo")}</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={isHex(value.accentTo) ? value.accentTo : "#000000"}
                  onChange={(e) => setValue((v) => ({ ...v, accentTo: e.target.value }))}
                  aria-label={t("admin.appearance.accentTo")}
                  className="size-9 cursor-pointer rounded-control border border-border bg-transparent p-1"
                />
                <Input
                  id="accent-to"
                  className="font-mono"
                  value={value.accentTo}
                  onChange={(e) => setValue((v) => ({ ...v, accentTo: e.target.value }))}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Radius */}
        <section className="rounded-card border border-border bg-card p-5">
          <h2 className="mb-3 text-sm font-semibold">{t("admin.appearance.radius")}</h2>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("admin.appearance.radius")}>
            {RADIUS_STYLES.map((r) => (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={value.radius === r}
                onClick={() => setValue((v) => ({ ...v, radius: r }))}
                className={cn(
                  "flex min-w-16 flex-col items-center gap-1.5 rounded-control border px-4 py-2.5 text-xs transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  value.radius === r
                    ? "border-ring bg-surface-2 font-medium"
                    : "border-border text-muted-foreground hover:bg-surface-2/60"
                )}
              >
                <span
                  className="size-6 border-2 border-current"
                  style={{ borderRadius: RADIUS_TOKENS[r].card }}
                />
                {r.toUpperCase()}
              </button>
            ))}
          </div>
        </section>

        {/* Hero style */}
        <section className="rounded-card border border-border bg-card p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="size-4 text-gradient-to" aria-hidden="true" />
            {t("admin.appearance.heroStyle")}
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {HERO_STYLES.map((style) => (
              <button
                key={style}
                type="button"
                aria-pressed={value.heroStyle === style}
                onClick={() => setValue((v) => ({ ...v, heroStyle: style }))}
                className={cn(
                  "overflow-hidden rounded-card border text-left transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  value.heroStyle === style
                    ? "border-ring ring-1 ring-ring"
                    : "border-border hover:border-muted-foreground/40"
                )}
              >
                <HeroMiniPreview style={style} accentFrom={value.accentFrom} accentTo={value.accentTo} />
                <p className="px-3 py-2 text-xs font-medium">
                  {t(`admin.appearance.hero_${style}`)}
                  {value.heroStyle === style && <Check className="ms-1.5 inline size-3.5" aria-hidden="true" />}
                </p>
              </button>
            ))}
          </div>
        </section>

        {/* Default theme */}
        <section className="rounded-card border border-border bg-card p-5">
          <h2 className="mb-3 text-sm font-semibold">{t("admin.appearance.defaultTheme")}</h2>
          <p className="mb-3 text-xs text-faint">{t("admin.appearance.defaultThemeHint")}</p>
          <div className="flex gap-2">
            {DEFAULT_THEME_OPTIONS.map((mode) => (
              <Button
                key={mode}
                type="button"
                variant={value.defaultTheme === mode ? "default" : "outline"}
                size="sm"
                aria-pressed={value.defaultTheme === mode}
                onClick={() => setValue((v) => ({ ...v, defaultTheme: mode }))}
              >
                {mode === "dark" ? t("common.themeDark") : t("common.themeLight")}
              </Button>
            ))}
          </div>
        </section>

        <div className="flex items-center gap-3">
          <Button onClick={() => void save()} disabled={saving || !dirty} variant="gradient">
            {saving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {saving ? t("common.saving") : t("common.save")}
          </Button>
          {dirty && (
            <Button variant="ghost" onClick={() => setValue(initial)} disabled={saving}>
              {t("common.cancel")}
            </Button>
          )}
        </div>
      </div>

      {/* ── Live preview ── */}
      <aside className="xl:sticky xl:top-20 xl:self-start">
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-faint">
          {t("admin.appearance.preview")}
        </p>
        <div
          style={previewVars}
          className="overflow-hidden rounded-card border border-border bg-background shadow-card-hover"
          aria-label={t("admin.appearance.preview")}
        >
          <div className="relative">
            <HeroMiniPreview
              style={value.heroStyle}
              accentFrom={value.accentFrom}
              accentTo={value.accentTo}
              tall
              showChrome
            />
          </div>
          <div className="flex flex-col gap-3 p-4">
            <div className="flex items-center gap-2">
              <span
                className="flex size-6 items-center justify-center rounded bg-accent-gradient text-[10px] font-bold text-white"
                aria-hidden="true"
              >
                H
              </span>
              <span className="bg-accent-gradient bg-clip-text text-sm font-semibold text-transparent">
                HiTo
              </span>
              <span className="ms-auto rounded-full bg-surface-2 px-2 py-0.5 text-[10px] text-faint">v1.0</span>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="card-glow relative flex flex-col gap-1.5 overflow-hidden rounded-card border border-border bg-card p-3"
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      className="flex size-4 items-center justify-center rounded bg-accent-gradient text-[8px] font-bold text-white"
                      aria-hidden="true"
                    >
                      {i}
                    </span>
                    <span className="h-2 w-12 rounded-full bg-surface-3" />
                  </div>
                  <span className="h-1.5 w-full rounded-full bg-surface-2" />
                  <span className="h-1.5 w-2/3 rounded-full bg-surface-2" />
                  <svg viewBox="0 0 24 24" className="absolute -right-2 -top-2 size-8 text-accent-from opacity-10" fill="currentColor" aria-hidden="true">
                    <path d={STAR} />
                  </svg>
                </div>
              ))}
            </div>
            <div className="flex gap-1.5">
              {["GitHub", "Figma", "Vercel"].map((tag) => (
                <span key={tag} className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] text-faint">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
        <p className="mt-2 text-xs text-faint">{t("admin.appearance.previewHint")}</p>
      </aside>
    </div>
  );
}

function HeroMiniPreview({
  style,
  accentFrom,
  accentTo,
  tall = false,
  showChrome = false,
}: {
  style: Appearance["heroStyle"];
  accentFrom: string;
  accentTo: string;
  tall?: boolean;
  showChrome?: boolean;
}) {
  const h = tall ? "h-40" : "h-16";
  return (
    <div className={cn("relative w-full overflow-hidden bg-background", h)}>
      {style === "aurora" && (
        <>
          <div
            className="absolute -left-6 -top-8 size-28 rounded-full opacity-40 blur-2xl"
            style={{ background: accentFrom }}
          />
          <div
            className="absolute -right-6 top-2 size-24 rounded-full opacity-40 blur-2xl"
            style={{ background: accentTo }}
          />
        </>
      )}
      {style === "grid" && (
        <>
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)",
              backgroundSize: "12px 12px",
              maskImage: "radial-gradient(ellipse 80% 70% at 50% 30%, black 30%, transparent 75%)",
              WebkitMaskImage: "radial-gradient(ellipse 80% 70% at 50% 30%, black 30%, transparent 75%)",
            }}
          />
        </>
      )}
      {showChrome && (
        <div className="relative z-10 flex h-8 items-center gap-2 border-b border-border bg-background/70 px-3 backdrop-blur">
          <span className="size-2 rounded-full bg-danger/70" />
          <span className="size-2 rounded-full bg-warning/70" />
          <span className="size-2 rounded-full bg-success/70" />
          <span className="mx-auto h-3 w-24 rounded-full bg-surface-2" />
        </div>
      )}
      <div className={cn("relative z-[1] flex flex-col items-start justify-center gap-1.5 px-4", tall ? "h-32" : "h-full")}>
        {tall ? (
          <>
            <span className="rounded-full border border-border bg-surface/60 px-2 py-0.5 text-[9px] text-muted-foreground backdrop-blur">
              ✦ Curated tools
            </span>
            <span className="text-base font-semibold tracking-tight">
              Good tools,{" "}
              <span className="bg-clip-text text-transparent" style={{ backgroundImage: `linear-gradient(135deg, ${accentFrom}, ${accentTo})` }}>
                one place
              </span>
            </span>
            <span className="h-2 w-3/5 rounded-full bg-surface-2" />
          </>
        ) : (
          <span
            className="h-2 w-1/2 rounded-full"
            style={{ backgroundImage: `linear-gradient(90deg, ${accentFrom}, ${accentTo})` }}
          />
        )}
      </div>
    </div>
  );
}
