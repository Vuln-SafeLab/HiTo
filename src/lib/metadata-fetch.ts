import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import http from "node:http";
import https from "node:https";

export interface UrlMetadata {
  title: string | null;
  description: string | null;
  image: string | null;
  favicon: string | null;
}

const PRIVATE_V4_PATTERNS = [
  /^0\./,
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  // 100.64.0.0/10 (CGNAT) — commonly abused to bypass naive SSRF blocklists
  /^100\.(6[4-9]|[7-9]\d|1[0-1]\d|12[0-7])\./,
];

/** Convert a compact hex IPv4-mapped IPv6 (e.g. ::ffff:7f00:1) to dotted-decimal (127.0.0.1). */
function hexMappedV4ToDotted(hex: string): string | null {
  // Accepts 1-8 hex digits per group, leading zeros optional
  const groups = hex.split(":");
  if (groups.length !== 4) return null;
  const parts: number[] = [];
  for (const g of groups) {
    if (g.length === 0 || g.length > 4) return null;
    const n = Number.parseInt(g, 16);
    if (!Number.isFinite(n) || n < 0 || n > 0xffff) return null;
    parts.push(n);
  }
  // Convert two 16-bit groups into one IPv4 octet: (hi<<8 | lo) = decimal
  const out: number[] = [];
  for (let i = 0; i < 4; i += 2) {
    const g1 = parts[i] ?? 0;
    const g2 = parts[i + 1] ?? 0;
    out.push((g1 << 8) | g2);
  }
  if (out.some((oct) => oct < 0 || oct > 255)) return null;
  return out.join(".");
}

function isPrivateIp(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower.includes(":")) {
    if (lower === "::" || lower === "::1") return true;
    if (lower.startsWith("fe80") || lower.startsWith("fc") || lower.startsWith("fd")) return true;
    // Dotted-decimal IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1)
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped?.[1] !== undefined) return isPrivateIp(mapped[1]);
    // Hex-form IPv4-mapped IPv6 (e.g. ::ffff:7f00:1 → 127.0.0.1)
    const hexMapped = lower.match(/^::ffff:([0-9a-f:]+)$/);
    if (hexMapped?.[1] !== undefined) {
      const dotted = hexMappedV4ToDotted(hexMapped[1]);
      if (dotted !== null) return isPrivateIp(dotted);
    }
    return false;
  }
  return PRIVATE_V4_PATTERNS.some((pattern) => pattern.test(lower));
}

export async function resolvePublicHttpTarget(
  url: URL
): Promise<{ ip: string; port: number } | null> {
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) {
    return null;
  }
  let ip: string;
  if (isIP(host) !== 0) {
    ip = host;
  } else {
    try {
      const addresses = await lookup(host, { all: true });
      const publicEntry = addresses.find((entry) => !isPrivateIp(entry.address));
      if (publicEntry === undefined) return null;
      ip = publicEntry.address;
    } catch {
      return null;
    }
  }
  if (isPrivateIp(ip)) return null;
  return { ip, port: url.port === "" ? (url.protocol === "https:" ? 443 : 80) : Number(url.port) };
}

export interface RawResponse {
  status: number;
  contentType: string;
  location: string | null;
  finalUrl: string;
  readCappedBytes(maxBytes: number): Promise<Uint8Array>;
}

export function pinnedFetch(
  url: URL,
  ip: string,
  port: number,
  options: { method: "GET" | "HEAD"; timeoutMs: number; maxBytes: number; userAgent: string; accept?: string }
): Promise<RawResponse | null> {
  return new Promise((resolve) => {
    const isHttps = url.protocol === "https:";
    const transport = isHttps ? https : http;
    const req = transport.request(
      {
        host: ip,
        port,
        path: `${url.pathname}${url.search}`,
        method: options.method,
        servername: isHttps ? url.hostname : undefined,
        headers: {
          Host: url.host,
          "User-Agent": options.userAgent,
          ...(options.accept !== undefined ? { Accept: options.accept } : {}),
          Connection: "close",
        },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const headers = res.headers;
        res.on("error", () => resolve(null));
        resolve({
          status,
          contentType: String(headers["content-type"] ?? ""),
          location: typeof headers.location === "string" ? headers.location : null,
          finalUrl: url.toString(),
          async readCappedBytes(maxBytes: number): Promise<Uint8Array> {
            return await new Promise((done) => {
              const chunks: Buffer[] = [];
              let received = 0;
              res.on("data", (chunk: Buffer) => {
                received += chunk.byteLength;
                chunks.push(chunk);
                if (received >= maxBytes) {
                  res.destroy();
                  done(Buffer.concat(chunks).subarray(0, maxBytes));
                }
              });
              res.on("end", () => done(Buffer.concat(chunks)));
              res.on("error", () => done(Buffer.concat(chunks)));
            });
          },
        });
      }
    );
    req.setTimeout(options.timeoutMs, () => {
      req.destroy(new Error("timeout"));
    });
    req.on("error", () => resolve(null));
    req.end();
  });
}

const FETCH_TIMEOUT_MS = 8000;
const MAX_HTML_BYTES = 512 * 1024;
const MAX_REDIRECTS = 3;

async function fetchWithGuards(startUrl: URL): Promise<{ status: number; contentType: string; finalUrl: string; bytes: Uint8Array } | null> {
  let current = startUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const target = await resolvePublicHttpTarget(current);
    if (target === null) return null;
    const response = await pinnedFetch(current, target.ip, target.port, {
      method: "GET",
      timeoutMs: FETCH_TIMEOUT_MS,
      maxBytes: MAX_HTML_BYTES,
      userAgent: "Mozilla/5.0 (compatible; HiToBot/1.0; +link-preview)",
      accept: "text/html,application/xhtml+xml",
    });
    if (response === null) return null;

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.location;
      if (location === null) return null;
      try {
        current = new URL(location, current);
      } catch {
        return null;
      }
      continue;
    }
    const bytes = await response.readCappedBytes(MAX_HTML_BYTES);
    return { status: response.status, contentType: response.contentType, finalUrl: response.finalUrl, bytes };
  }
  return null;
}

function decodeEntities(text: string): string {
  return text
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&nbsp;", " ");
}

function parseTagAttributes(tag: string): Map<string, string> {
  const attributes = new Map<string, string>();
  for (const match of tag.matchAll(/([a-zA-Z-]+)\s*=\s*["']([^"']*)["']/g)) {
    const key = match[1];
    const value = match[2];
    if (key !== undefined && value !== undefined) {
      attributes.set(key.toLowerCase(), value);
    }
  }
  return attributes;
}

function resolveUrl(href: string, base: string): string | null {
  try {
    const resolved = new URL(href, base);
    if (resolved.protocol !== "http:" && resolved.protocol !== "https:") return null;
    return resolved.toString().slice(0, 2048);
  } catch {
    return null;
  }
}

export async function fetchUrlMetadata(rawUrl: string): Promise<UrlMetadata | null> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  const result = await fetchWithGuards(url);
  if (result === null || result.status < 200 || result.status >= 300) return null;
  if (!result.contentType.includes("html")) return null;

  const baseUrl = result.finalUrl;
  const decoder = new TextDecoder("utf-8", { fatal: false });
  const html = decoder.decode(result.bytes);

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  let title = titleMatch?.[1] !== undefined ? decodeEntities(titleMatch[1]).trim() : null;

  let description: string | null = null;
  let image: string | null = null;
  let favicon: string | null = null;

  for (const match of html.matchAll(/<meta\s+[^>]*>/gi)) {
    const attrs = parseTagAttributes(match[0]);
    const key = attrs.get("property") ?? attrs.get("name");
    const content = attrs.get("content");
    if (key === undefined || content === undefined || content === "") continue;
    const normalized = key.toLowerCase();
    if (normalized === "og:title" && title === null) title = decodeEntities(content).trim();
    if ((normalized === "description" || normalized === "og:description") && description === null) {
      description = decodeEntities(content).trim();
    }
    if ((normalized === "og:image" || normalized === "twitter:image") && image === null) {
      image = resolveUrl(content, baseUrl);
    }
  }

  for (const match of html.matchAll(/<link\s+[^>]*>/gi)) {
    const attrs = parseTagAttributes(match[0]);
    const rel = attrs.get("rel")?.toLowerCase() ?? "";
    const href = attrs.get("href");
    if (href !== undefined && href !== "" && rel.includes("icon") && favicon === null) {
      favicon = resolveUrl(href, baseUrl);
    }
  }
  if (favicon === null) {
    favicon = `${new URL(baseUrl).origin}/favicon.ico`;
  }

  return {
    title: title !== null && title !== "" ? title.slice(0, 191) : null,
    description: description !== null && description !== "" ? description.slice(0, 500) : null,
    image,
    favicon,
  };
}
