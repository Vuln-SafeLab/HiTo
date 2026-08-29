import {
  ALLOWED_METHODS,
  ENGINE_DEFAULTS,
  PAYLOAD_PATTERN_SOURCES,
  PROBE_PREFIXES,
  PROBE_SUFFIXES,
} from "./rules";

const PAYLOAD_RE = new RegExp(PAYLOAD_PATTERN_SOURCES.join("|"), "i");
const CONTROL_CHARS_RE = /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/;
const LOWER_PROBES = PROBE_PREFIXES.map((p) => ({ entry: p, lower: p.toLowerCase() }));
const LOWER_SUFFIXES = PROBE_SUFFIXES.map((p) => ({ entry: p, lower: p.toLowerCase() }));

function truncate(input: string): string {
  return input.length <= ENGINE_DEFAULTS.SCAN_TRUNCATE
    ? input
    : input.slice(0, ENGINE_DEFAULTS.SCAN_TRUNCATE);
}

export function decodeOnce(input: string): string {
  try {
    return decodeURIComponent(input).replace(/\+/g, " ");
  } catch {
    return input.replace(/\+/g, " ");
  }
}

export interface ScanInput {
  method: string;
  pathname: string;
  search: string;
  headerSample: string;
  cookieHasSession: boolean;
}

export type ScanHit = { ruleId: string } | null;

export function scanStructure(input: ScanInput): ScanHit {
  if (!ALLOWED_METHODS.has(input.method.toUpperCase())) {
    return { ruleId: "K1.method" };
  }
  const urlLen = input.pathname.length + input.search.length;
  if (urlLen > ENGINE_DEFAULTS.MAX_URL_LEN) {
    return { ruleId: "K1.urllen" };
  }
  if (CONTROL_CHARS_RE.test(truncate(input.pathname + input.search))) {
    return { ruleId: "K1.ctlchar" };
  }
  if (input.headerSample.includes("\u0000")) {
    return { ruleId: "K1.ctlchar" };
  }
  return null;
}

export function scanProbePath(pathname: string, disabled?: Set<string>): ScanHit {
  // Scan the raw path AND single/double decoded forms: the edge runtime's
  // decodeURIComponent is lenient (invalid %c0%ae decodes to replacement chars
  // without throwing), so decode-once-only scanners go blind on obfuscated paths.
  const candidates = new Set<string>();
  const lower = pathname.toLowerCase();
  candidates.add(lower);
  candidates.add(decodeOnce(lower));
  const twice = safeDecodeTwice(lower);
  if (twice !== null) candidates.add(twice);

  for (const candidate of candidates) {
    for (const probe of LOWER_PROBES) {
      if (disabled?.has(`prefix:${probe.entry}`)) continue;
      if (candidate.startsWith(probe.lower) || candidate.includes(probe.lower)) {
        return { ruleId: "K2.probe" };
      }
    }
    for (const suffix of LOWER_SUFFIXES) {
      if (disabled?.has(`suffix:${suffix.entry}`)) continue;
      if (candidate.endsWith(suffix.lower)) return { ruleId: "K2.probe" };
    }
  }
  return null;
}

function safeDecodeTwice(input: string): string | null {
  try {
    return decodeOnce(decodeOnce(input));
  } catch {
    return null;
  }
}

/** L3 skips session cookies to reduce false positives. */
export function scanPayload(input: ScanInput): ScanHit {
  if (input.cookieHasSession) return null;
  const raw = truncate(input.pathname + input.search);
  const once = truncate(decodeOnce(input.pathname + input.search) + "\n" + input.headerSample);
  // Double-decoded haystack catches %2527-style double-encoding bypasses.
  const twice = safeDecodeTwice(input.pathname + input.search);
  if (PAYLOAD_RE.test(raw) || PAYLOAD_RE.test(once)) return { ruleId: "K3.payload" };
  if (twice !== null && PAYLOAD_RE.test(truncate(twice))) return { ruleId: "K3.payload" };
  return null;
}
