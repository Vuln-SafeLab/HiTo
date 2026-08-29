import { toast } from "sonner";

export async function copyCardLink(
  url: string,
  successMessage: string,
  errorMessage: string
): Promise<void> {
  try {
    await navigator.clipboard.writeText(url);
    toast.success(successMessage);
  } catch {
    toast.error(errorMessage);
  }
}

export function trackCardClick(cardId: string): void {
  const payload = JSON.stringify({ cardId });
  try {
    const blob = new Blob([payload], { type: "application/json" });
    if (navigator.sendBeacon("/api/track/click", blob)) return;
  } catch {
    // fall through to keepalive fetch
  }
  void fetch("/api/track/click", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => undefined);
}
