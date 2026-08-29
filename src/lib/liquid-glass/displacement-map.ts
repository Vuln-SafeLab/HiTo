import { GLASS } from "@/lib/liquid-glass/config";

export interface MapInput {
  width: number;
  height: number;
  radius: number;
  dpr: number;
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function buildDisplacementMap(input: MapInput): string | null {
  if (typeof document === "undefined") return null;
  const { width, height, radius } = input;
  if (width <= 0 || height <= 0) return null;

  const { border, mapBlur, dprCap } = GLASS.refraction;
  const scale = Math.min(input.dpr || 1, dprCap);
  const w = Math.max(2, Math.round(width * scale));
  const h = Math.max(2, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (ctx === null) return null;

  ctx.fillStyle = "#808080";
  ctx.fillRect(0, 0, w, h);

  const gx = ctx.createLinearGradient(0, 0, w, 0);
  gx.addColorStop(0, "#000000");
  gx.addColorStop(1, "#ff0000");
  ctx.fillStyle = gx;
  ctx.fillRect(0, 0, w, h);

  ctx.globalCompositeOperation = "difference";
  const gy = ctx.createLinearGradient(0, 0, 0, h);
  gy.addColorStop(0, "#000000");
  gy.addColorStop(1, "#0000ff");
  ctx.fillStyle = gy;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = "source-over";

  const inset = Math.min(w, h) * border;
  const rr = Math.max(0, radius * scale - inset);
  ctx.save();
  ctx.filter = `blur(${mapBlur * scale}px)`;
  ctx.fillStyle = "#808080";
  roundRectPath(ctx, inset, inset, w - inset * 2, h - inset * 2, rr);
  ctx.fill();
  ctx.restore();

  try {
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

export function sanitizeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, "_");
}

export function filterUrl(id: string): string {
  if (typeof window === "undefined") return `url(#${id})`;
  return `url(${window.location.pathname}${window.location.search}#${id})`;
}
