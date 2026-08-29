import { headers } from "next/headers";
import { AdCodeRenderer } from "@/components/public/ad-code-renderer";
import { detectDevice, getAdsForPosition } from "@/lib/ads";
import type { AdPositionValue } from "@/lib/validators/ads";

export async function AdSlot({
  position,
  className,
}: {
  position: AdPositionValue;
  className?: string;
}) {
  const userAgent = (await headers()).get("user-agent") ?? "";
  const ads = await getAdsForPosition(position, detectDevice(userAgent));
  if (ads.length === 0) return null;

  return (
    <div data-ad-position={position} className={className}>
      {ads.map((ad) => (
        <AdUnit key={ad.id} type={ad.type} code={ad.code} />
      ))}
    </div>
  );
}

function AdUnit({ type, code }: { type: "SCRIPT" | "HTML" | "IMAGE" | "IFRAME"; code: string }) {
  if (type === "IMAGE") {
    if (!code.trimStart().startsWith("<")) {
      const url = code.trim();
      const isSafe = /^https?:\/\/\S+$/i.test(url) || /^\/(?!\/)\S*$/.test(url);
      if (!isSafe) return null;
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt="advertisement"
          loading="lazy"
          decoding="async"
          style={{ maxWidth: "100%", height: "auto", border: 0 }}
        />
      );
    }
    return <AdCodeRenderer code={code} />;
  }
  return <AdCodeRenderer code={code} />;
}

export async function getPopupAd(): Promise<{ id: string; code: string } | null> {
  const userAgent = (await headers()).get("user-agent") ?? "";
  const ads = await getAdsForPosition("POPUP", detectDevice(userAgent));
  const first = ads[0];
  return first === undefined ? null : { id: first.id, code: first.code };
}
