// next/image blur placeholder: inline SVG, no sharp dependency. URL-encoded (not base64) for zero-deps server/client use
export function shimmerDataUrl(width: number, height: number): string {
  const svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#1c1c1f"/><stop offset="100%" stop-color="#141416"/></linearGradient></defs><rect width="${width}" height="${height}" fill="url(#g)"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const OPTIMIZABLE_HOSTS = new Set(["picsum.photos", "fastly.picsum.photos"]);

export function isOptimizableImage(src: string): boolean {
  if (src.startsWith("/")) return true;
  try {
    return OPTIMIZABLE_HOSTS.has(new URL(src).hostname);
  } catch {
    return false;
  }
}
