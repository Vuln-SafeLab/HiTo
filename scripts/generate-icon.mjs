// HiTo brand icon rasterizer — correct signed-distance fields, zero deps.
// Renders: site compass (16→2048) + Kun engine shield (512) + icon-data.ts
// Design space: 1024×1024. Run: node scripts/generate-icon.mjs
import { deflateSync } from "node:zlib";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = path.resolve(process.cwd());
const OUT_DIR = path.join(ROOT, "public", "icons");
const APP_DIR = path.join(ROOT, "src", "app");
const ENGINE_DIR = path.join(ROOT, "src", "lib", "security", "engine");

// ── palette ──
const INK = [0x0b, 0x0f, 0x1c];        // deep navy (icon bg / cutouts)
const WHITE = [0xf1, 0xf5, 0xfb];      // needle north
const CYAN = [0x22, 0xd3, 0xee];       // brand accent-to
const VIOLET = [0xa7, 0x8b, 0xfa];     // brand accent-from (soft)
const CYAN_DIM = [0x0e, 0x7d, 0x94];   // needle south (engine)
const CYAN_SHIELD = [0x22, 0xd3, 0xee];

function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
function smoothstep(e0, e1, x) { const t = clamp01((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); }
// 1 inside (sd ≤ 0), feathered to 0 across `feather` px outside
function fill(sd, feather) { return smoothstep(0, feather, -sd); }
const hypot = (x, y) => Math.sqrt(x * x + y * y);

// signed-distance layers (sd < 0 inside)
function layerDisk(r, cx, cy, color) {
  return { color, sd(x, y) { return hypot(x - cx, y - cy) - r; } };
}
function layerRing(rMid, halfW, cx, cy, color) {
  return { color, sd(x, y) { return Math.abs(hypot(x - cx, y - cy) - rMid) - halfW; } };
}
function layerSegment(x1, y1, x2, y2, halfW, color) {
  return {
    color,
    sd(x, y) {
      const dx = x2 - x1, dy = y2 - y1;
      const len2 = dx * dx + dy * dy || 1;
      const t = clamp01(((x - x1) * dx + (y - y1) * dy) / len2);
      return hypot(x - (x1 + t * dx), y - (y1 + t * dy)) - halfW;
    },
  };
}
function layerTriangle(p1, p2, p3, color) {
  const edge = (a, b) => (x, y) => (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]);
  const e1 = edge(p1, p2), e2 = edge(p2, p3), e3 = edge(p3, p1);
  return {
    color,
    sd(x, y) {
      const d1 = e1(x, y), d2 = e2(x, y), d3 = e3(x, y);
      const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
      const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
      const dmin = Math.min(Math.abs(d1), Math.abs(d2), Math.abs(d3));
      return hasNeg && hasPos ? dmin : -dmin; // convex: sign tells inside
    },
  };
}
// clip: multiply alpha by a half-plane factor (for gradient-split rings)
function withClip(layer, clipFn) {
  return { color: layer.color, sd: layer.sd, clip: clipFn };
}

function composite(layers, S) {
  const out = new Uint8ClampedArray(S * S * 4);
  for (let py = 0; py < S; py++) {
    for (let px = 0; px < S; px++) {
      const x = (px + 0.5) * (1024 / S), y = (py + 0.5) * (1024 / S);
      // painter's algorithm: later layers sit ON TOP
      let r = 0, g = 0, b = 0, a = 0;
      for (const layer of layers) {
        let alpha = fill(layer.sd(x, y), Math.max(1.1, 1.4 * (1024 / S)));
        if (layer.clip) alpha *= layer.clip(x, y);
        if (alpha <= 0) continue;
        r = layer.color[0] * alpha + r * (1 - alpha);
        g = layer.color[1] * alpha + g * (1 - alpha);
        b = layer.color[2] * alpha + b * (1 - alpha);
        a = alpha + a * (1 - alpha);
      }
      const i = (py * S + px) * 4;
      out[i] = r; out[i + 1] = g; out[i + 2] = b; out[i + 3] = a * 255;
    }
  }
  return out;
}

// ── site mark: dark compass — needle + violet/cyan ring + node ──
function siteLayers() {
  const diagonalSplit = (x, y) => smoothstep(-60, 60, y - x); // 1 below diagonal → cyan side
  return [
    layerDisk(470, 512, 512, INK),
    // outer brand ring: violet (upper-left of diagonal) / cyan (lower-right)
    withClip(layerRing(444, 26, 512, 512, VIOLET), (x, y) => 1 - diagonalSplit(x, y)),
    withClip(layerRing(444, 26, 512, 512, CYAN), (x, y) => diagonalSplit(x, y)),
    // needle: white north, cyan south
    layerTriangle([512, 176], [596, 512], [428, 512], WHITE),
    layerTriangle([428, 512], [596, 512], [512, 848], CYAN),
    // hub
    layerDisk(30, 512, 512, WHITE),
  ];
}

// ── engine mark: Kun shield — cyan shield, ink panel, needle, node ──
function kunLayers() {
  return [
    layerDisk(350, 512, 400, CYAN_SHIELD),
    layerTriangle([212, 392], [812, 392], [512, 880], CYAN_SHIELD),
    layerDisk(286, 512, 408, INK),
    layerTriangle([288, 408], [736, 408], [512, 760], INK),
    layerTriangle([512, 240], [586, 434], [438, 434], WHITE),
    layerTriangle([438, 434], [586, 434], [512, 646], CYAN_DIM),
    layerDisk(34, 512, 434, WHITE),
  ];
}

// ── PNG encoder ──
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

// ── main ──
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
export function renderSite(S) { return composite(siteLayers(), S); }
export function renderKun(S) { return composite(kunLayers(), S); }
export { encodePng };

if (isMain) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(APP_DIR, { recursive: true });

  for (const size of [16, 32, 180, 192, 512, 1024, 2048]) {
    const png = encodePng(renderSite(size), size);
    fs.writeFileSync(path.join(OUT_DIR, `hito-${size}.png`), png);
    if (size === 512) fs.writeFileSync(path.join(APP_DIR, "icon.png"), png);
    if (size === 180) fs.writeFileSync(path.join(APP_DIR, "apple-icon.png"), png);
    console.log(`hito-${size}.png  ${png.length} bytes`);
  }

  const kunPng = encodePng(renderKun(512), 512);
  const kun512B64 = kunPng.toString("base64");
  fs.writeFileSync(path.join(OUT_DIR, "kun-512.png"), kunPng);
  console.log(`kun-512.png  ${kunPng.length} bytes (b64 ${kun512B64.length})`);

  fs.writeFileSync(
    path.join(ENGINE_DIR, "icon-data.ts"),
    `// AUTO-GENERATED by scripts/generate-icon.mjs — do not edit\nexport const KUN_ICON_512_BASE64 = "${kun512B64}";\n`
  );
  console.log("icon-data.ts refreshed (Kun shield @512)");
}
