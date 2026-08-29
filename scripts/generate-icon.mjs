// HiTo 品牌图标光栅化：解析式 AA，零依赖。设计坐标 1024（与 SVG 一致），输出 7 个尺寸 + icon-data.ts。
import { deflateSync } from "node:zlib";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.cwd());
const OUT_DIR = path.join(ROOT, "public", "icons");
const APP_DIR = path.join(ROOT, "src", "app");
const ENGINE_DIR = path.join(ROOT, "src", "lib", "security", "engine");

const COL_DISK = [0x1b, 0x24, 0x38];
const COL_LINE = [0xf1, 0xf5, 0xfb];
const COL_NODE = [0x34, 0xd3, 0xee];
const COL_RING = [0xb1, 0x8c, 0xff];

function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
function smoothstep(e0, e1, x) { const t = clamp01((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); }
function edge(a, b, x, y) { return (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]); }

function layerDisk(rd, r, cx, cy, color) {
  return { color, draw(x, y) { const dx = x - cx, dy = y - cy; const d = Math.sqrt(dx * dx + dy * dy); return smoothstep(r - rd, r, rd - d); } };
}
function layerRing(ro, ri, cx, cy, color) {
  return { color, draw(x, y) { const dx = x - cx, dy = y - cy; const d = Math.sqrt(dx * dx + dy * dy); return clamp01(smoothstep(ri - ro, ri, ro - d) - smoothstep(0, ro, ri - d)); } };
}
function layerSegment(x1, y1, x2, y2, w, color) {
  const dx = x2 - x1, dy = y2 - y1, len = Math.sqrt(dx * dx + dy * dy);
  const ux = dx / len, uy = dy / len, nx = -uy, ny = ux, hw = w / 2;
  return { color, draw(x, y) { const vx = x - x1, vy = y - y1; const t = vx * ux + vy * uy; if (t < 0 || t > len) return 0; const d = Math.abs(vx * nx + vy * ny); return smoothstep(hw, hw - 1, d); } };
}
function layerTriangle(p1, p2, p3, color) {
  return {
    color,
    draw(x, y) {
      const d1 = edge(p1, p2, x, y), d2 = edge(p2, p3, x, y), d3 = edge(p3, p1, x, y);
      const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
      const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
      if (hasNeg && hasPos) return 0;
      const d = Math.min(Math.abs(d1), Math.abs(d2), Math.abs(d3));
      return smoothstep(1.2, 0, d);
    }
  };
}

function makeLayers(s) {
  return [
    layerDisk(0.5, 480 * s, 512 * s, 500 * s, COL_DISK),
    layerDisk(0.5, 104 * s, 368 * s, 668 * s, COL_NODE),
    layerRing((126 + 49) * s, (126 - 49) * s, 662 * s, 344 * s, COL_RING),
    layerTriangle([470 * s, 372 * s], [594 * s, 348 * s], [556 * s, 466 * s], COL_LINE),
    layerSegment(392 * s, 640 * s, 618 * s, 404 * s, 112, COL_LINE),
  ];
}

function rasterize(S) {
  const out = new Uint8ClampedArray(S * S * 4);
  const layers = makeLayers(S / 1024);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (const layer of layers) {
        const alpha = layer.draw(x + 0.5, y + 0.5);
        if (alpha <= 0) continue;
        const ia = 1 - a;
        r = layer.color[0] * alpha * ia + r;
        g = layer.color[1] * alpha * ia + g;
        b = layer.color[2] * alpha * ia + b;
        a = alpha * ia + a;
        if (a > 0.999) break;
      }
      const i = (y * S + x) * 4;
      out[i] = r; out[i + 1] = g; out[i + 2] = b; out[i + 3] = a * 255;
    }
  }
  return out;
}

const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; }
  return t;
})();
function crc32(b) { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function encodePng(rgba, S) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(S, 0); ihdr.writeUInt32BE(S, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  const stride = S * 4;
  const raw = Buffer.alloc((stride + 1) * S);
  for (let y = 0; y < S; y++) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(APP_DIR, { recursive: true });
fs.mkdirSync(ENGINE_DIR, { recursive: true });

const SIZES = [16, 32, 180, 192, 512, 1024, 2048];
let icon32B64 = "";
for (const size of SIZES) {
  const rgba = rasterize(size);
  const png = encodePng(Uint8Array.from(rgba), size);
  fs.writeFileSync(path.join(OUT_DIR, `hito-${size}.png`), png);
  if (size === 512) fs.writeFileSync(path.join(APP_DIR, "icon.png"), png);
  if (size === 180) fs.writeFileSync(path.join(APP_DIR, "apple-icon.png"), png);
  if (size === 32) icon32B64 = png.toString("base64");
  console.log(`hito-${size}.png  ${png.length} bytes`);
}

const icon512 = fs.statSync(path.join(OUT_DIR, "hito-512.png")).size;
const apple180 = fs.statSync(path.join(OUT_DIR, "hito-180.png")).size;
const icon16 = fs.statSync(path.join(OUT_DIR, "hito-16.png")).size;
console.log(`budget: icon.png(512)=${icon512}B (≤150KB ${icon512 <= 150 * 1024 ? "PASS" : "FAIL"}), apple.png(180)=${apple180}B (≤60KB ${apple180 <= 60 * 1024 ? "PASS" : "FAIL"}), favicon(16)=${icon16}B`);

fs.writeFileSync(
  path.join(ENGINE_DIR, "icon-data.ts"),
  `// AUTO-GENERATED by scripts/generate-icon.mjs — do not edit\nexport const KUN_ICON_32_BASE64 = "${icon32B64}";\n`
);
console.log("icon-data.ts refreshed");
