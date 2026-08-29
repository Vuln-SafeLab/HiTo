"use client";

// zod validation runs in the Server Action; this only parses per-line for preview.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { saveAdsTxtAction } from "@/lib/actions/ads-txt";

interface AdsRow {
  domain?: string; pubId?: string; type?: string; certId?: string;
  raw?: string; invalid?: boolean;
}
function parseLines(text: string): AdsRow[] {
  const rows: AdsRow[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#")) continue;
    const parts = line.split(",").map((part) => part.trim());
    if (parts.length !== 4) { rows.push({ raw: line, invalid: true }); continue; }
    const domain = parts[0] ?? "";
    const pubId = parts[1] ?? "";
    const kind = parts[2] ?? "";
    const certId = parts[3] ?? "";
    if (
      domain !== "" &&
      /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/.test(domain.toLowerCase()) &&
      pubId.length > 0 && pubId.length <= 128 &&
      /^(DIRECT|RESELLER)$/i.test(kind) &&
      /^[A-Za-z0-9-]+$/.test(certId) && certId.length <= 128
    ) {
      rows.push({ domain, pubId, type: kind.toUpperCase(), certId });
    } else {
      rows.push({ raw: line, invalid: true });
    }
  }
  return rows;
}

export function AdsTxtCard({ initial }: { initial: string }) {
  const router = useRouter();
  const t = useTranslations();
  
  const [text, setText] = useState(initial);
  const [saving, setSaving] = useState(false);

  const rows = parseLines(text);
  const invalidCount = rows.filter((r) => "invalid" in r).length;
  const bytes = new TextEncoder().encode(text).length;

  async function save(): Promise<void> {
    setSaving(true);
    const result = await saveAdsTxtAction({ content: text });
    setSaving(false);
    if (result.ok) {
      toast.success(t("common.saved"));
      router.refresh();
    } else if (!result.ok && result.code === "invalidAdsTxt") {
      toast.error(t("waf.adsInvalid"));
    } else {
      toast.error(t("errors.generic"));
    }
  }

  return (
    <section className="rounded-card border border-border bg-card p-5">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-sm font-semibold">ads.txt</h2>
        <code className="text-xs text-faint">GET /ads.txt</code>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">{t("ads.adsTxtHint")}</p>
      <Label htmlFor="ads-txt" className="sr-only">ads.txt</Label>
      <Textarea
        id="ads-txt"
        rows={8}
        className="font-mono text-xs"
        spellCheck={false}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={"google.com, pub-0000000000, DIRECT, f08c47fec0942fa0"}
      />
      <div className="mt-1 flex items-center justify-between text-xs text-faint">
        <span>{invalidCount > 0 ? t("ads.adsInvalidLines", { count: invalidCount }) : t("ads.adsValid")}</span>
        <span>{bytes.toLocaleString()} B / 256 KB</span>
      </div>

      {rows.length > 0 && (
        <table className="mt-3 w-full text-left text-xs">
          <thead className="text-muted-foreground">
            <tr><th className="py-1 pr-3">{t("ads.colDomain")}</th><th className="py-1 pr-3">PUB</th>
                <th className="py-1 pr-3">{t("ads.colType")}</th><th className="py-1">CERT</th></tr>
          </thead>
          <tbody>
            {rows.map((row, i) =>
              "invalid" in row ? (
                <tr key={i} className="border-t border-border">
                  <td colSpan={4} className="py-1 font-mono text-destructive">✗ {(row.raw ?? "").slice(0, 60)}</td>
                </tr>
              ) : (
                <tr key={i} className="border-t border-border">
                  <td className="py-1 pr-3 font-mono">{row.domain}</td>
                  <td className="py-1 pr-3 font-mono">{(row.pubId ?? "").slice(0, 20)}</td>
                  <td className="py-1 pr-3"><Badge variant={(row.type ?? "") === "DIRECT" ? "default" : "outline"}>{row.type ?? ""}</Badge></td>
                  <td className="py-1 font-mono">{(row.certId ?? "").slice(0, 24)}</td>
                </tr>
              )
            )}
          </tbody>
        </table>
      )}

      <div className="mt-3 flex justify-end">
        <Button size="sm" variant="gradient" disabled={saving || invalidCount > 0} onClick={() => void save()}>
          {saving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}
          {t("common.save")}
        </Button>
      </div>
    </section>
  );
}

