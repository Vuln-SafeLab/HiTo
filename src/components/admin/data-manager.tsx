"use client";

import { useRef, useState } from "react";
import { CloudDownload, FileDown, FileUp, Link2, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  exportCsvAction,
  exportJsonAction,
  fetchImportSourceAction,
  importCommitAction,
  importDryRunAction,
  type ImportPreview,
} from "@/lib/actions/data";
import { downloadText, errorKeyFor } from "./utils";

interface PendingImport {
  text: string;
  format: "json" | "csv";
  label: string;
  preview: ImportPreview;
}

const CLOUD_HINTS = [
  "Dropbox",
  "Google Drive",
  "OneDrive",
  "百度网盘",
  "阿里云盘",
  "坚果云 / WebDAV",
];

export function DataManager() {
  const t = useTranslations();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [busy, setBusy] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [url, setUrl] = useState("");
  const [pending, setPending] = useState<PendingImport | null>(null);

  async function exportAs(kind: "json" | "csv"): Promise<void> {
    setBusy(true);
    const outcome = kind === "json" ? await exportJsonAction() : await exportCsvAction();
    setBusy(false);
    if (!outcome.ok) {
      toast.error(t(errorKeyFor(outcome.code)));
      return;
    }
    downloadText(
      kind === "json" ? "hito-export.json" : "hito-export.csv",
      outcome.data.content,
      kind === "json" ? "application/json" : "text/csv;charset=utf-8"
    );
  }

  async function preparePending(text: string, format: "json" | "csv", label: string): Promise<void> {
    const outcome = await importDryRunAction({ text, format });
    if (!outcome.ok) {
      toast.error(t(errorKeyFor(outcome.code)));
      return;
    }
    setPending({ text, format, label, preview: outcome.data });
  }

  async function pickImportFile(file: File): Promise<void> {
    const fileFormat = file.name.toLowerCase().endsWith(".csv") ? "csv" : "json";
    const text = await file.text();
    setBusy(true);
    await preparePending(text, fileFormat, file.name);
    setBusy(false);
  }

  async function fetchFromUrl(): Promise<void> {
    if (url.trim() === "") return;
    setFetching(true);
    const outcome = await fetchImportSourceAction(url.trim());
    if (!outcome.ok) {
      setFetching(false);
      toast.error(t(errorKeyFor(outcome.code)));
      return;
    }
    await preparePending(outcome.data.text, outcome.data.format, url.trim());
    setFetching(false);
  }

  async function commitImport(): Promise<void> {
    if (pending === null) return;
    setBusy(true);
    const outcome = await importCommitAction({ text: pending.text, format: pending.format });
    setBusy(false);
    setPending(null);
    if (outcome.ok) {
      toast.success(
        t("admin.data.preview", {
          created: outcome.data.created,
          updated: outcome.data.updated,
          skipped: outcome.data.skipped,
        })
      );
      router.refresh();
    } else {
      toast.error(t(errorKeyFor(outcome.code)));
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("admin.nav.data")}</h1>

      <section className="rounded-card border border-border bg-card p-5">
        <h2 className="text-sm font-semibold">
          {t("admin.data.exportJson")} / {t("admin.data.exportCsv")}
        </h2>
        <p className="mt-1 text-xs text-faint">{t("admin.data.exportHint")}</p>
        <div className="mt-3 flex flex-wrap gap-3">
          <Button variant="outline" disabled={busy} onClick={() => void exportAs("json")}>
            <FileDown className="size-4" aria-hidden="true" />
            {t("admin.data.exportJson")}
          </Button>
          <Button variant="outline" disabled={busy} onClick={() => void exportAs("csv")}>
            <FileDown className="size-4" aria-hidden="true" />
            {t("admin.data.exportCsv")}
          </Button>
        </div>
      </section>

      <section className="rounded-card border border-border bg-card p-5">
        <h2 className="text-sm font-semibold">{t("admin.data.import")}</h2>
        <div className="mt-3">
          <Button variant="outline" disabled={busy} onClick={() => fileInputRef.current?.click()}>
            {busy && pending === null ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <FileUp className="size-4" aria-hidden="true" />
            )}
            {t("admin.data.dryRun")}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.csv,application/json,text/csv"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file !== undefined) void pickImportFile(file);
              event.target.value = "";
            }}
          />
        </div>
      </section>

      <section className="rounded-card border border-border bg-card p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <CloudDownload className="size-4 text-faint" aria-hidden="true" />
          {t("admin.data.importUrlTitle")}
        </h2>
        <p className="mt-1 text-xs text-faint">{t("admin.data.importUrlHint")}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://…/hito-export.json"
            className="min-w-0 flex-1"
            inputMode="url"
            aria-label={t("admin.data.importUrlTitle")}
          />
          <Button
            variant="secondary"
            disabled={fetching || busy || url.trim() === ""}
            onClick={() => void fetchFromUrl()}
          >
            {fetching ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Link2 className="size-4" aria-hidden="true" />
            )}
            {t("admin.data.fetchUrl")}
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-faint">{t("admin.data.cloudTips")}</span>
          {CLOUD_HINTS.map((name) => (
            <span
              key={name}
              className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs text-muted-foreground"
            >
              {name}
            </span>
          ))}
        </div>
      </section>

      {pending !== null && (
        <section className="rounded-card border border-ring bg-surface-2 p-5">
          <p className="text-sm">
            <span className="font-medium">{t("admin.data.previewTitle")}</span>
          </p>
          <p className="mt-1 break-all text-xs text-faint">{pending.label}</p>
          <p className="mt-2 text-sm">
            {t("admin.data.preview", {
              created: pending.preview.created,
              updated: pending.preview.updated,
              skipped: pending.preview.skipped,
            })}
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Button variant="gradient" disabled={busy} onClick={() => void commitImport()}>
              {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {t("admin.data.commit")}
            </Button>
            <Button variant="ghost" disabled={busy} onClick={() => setPending(null)}>
              {t("common.cancel")}
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
