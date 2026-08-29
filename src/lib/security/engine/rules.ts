// Edge runtime: no node:* / @/lib/env imports; all regexes must be linear-time (no ReDoS).
export type EngineMode = "off" | "log" | "block";

export const ENGINE_DEFAULTS = {
  MODE: "log" as EngineMode,
  UNDER_ATTACK_QPS: 600,
  CHALLENGE_TTL: 600,
  WINDOW_LIMIT: 300,
  WINDOW_MS: 10_000,
  BAN_BASE_MS: 30_000,
  BAN_MAX_MS: 24 * 3600 * 1000,
  SCAN_TRUNCATE: 4096,
  MAX_URL_LEN: 2048,
  MAX_HEADER_LEN: 4096,
  MAX_HEADER_COUNT: 96,
  POW_PREFIX: "000",
};

export const ALLOWED_METHODS = new Set([
  "GET", "HEAD", "POST", "PUT", "DELETE", "OPTIONS", "PATCH",
]);

export const PROBE_PREFIXES: string[] = [
  "/.env", "/.git/", "/.git/config", "/.aws", "/.ssh",
  "/wp-admin", "/wp-login.php", "/wp-content",
  "/phpmyadmin", "/pma/",
  "/actuator", "/swagger.json", "/api.json",
  "/cgi-bin/",
  "/vendor/phpunit",
  "/.DS_Store",
  "/web.config",
  "/.svn/",
  "/xmlrpc.php",
  "/adminer",
  "/solr/",
  "/jenkins/",
  "/manager/html",
  "/telescope",
];

export const PROBE_SUFFIXES: string[] = [
  ".sql", ".bak", ".old", ".orig", ".ini", ".conf", ".yml.bak",
  ".env", ".pem", ".key", ".log.", ".dump",
  ".swp", ".save", ".sqlite", ".sqlite3", ".db",
];

export const PAYLOAD_PATTERN_SOURCES: string[] = [
  String.raw`union[\s\x09-\x0d]+select`,
  String.raw`'\s*(?:or|and)\s*'?[\d]'?\s*=`,
  String.raw`\b(?:or|and)\b[\s\x09-\x0d]+[\d]+[\s\x09-\x0d]*=[\s\x09-\x0d]*[\d]+`,
  String.raw`\b(?:sleep|benchmark|waitfor)\s*\(`,
  String.raw`\binformation_schema\b`,
  String.raw`;\s*drop\s+table`,
  String.raw`--\s*$`,
  String.raw`<\s*script`,
  String.raw`javascript\s*:`,
  String.raw`\bon(?:error|load|click|mouseover)\s*=`,
  String.raw`<\s*(?:iframe|embed|object)\b[^>]*\bsrc\s*=`,
  String.raw`(?:\.\./|\.\.\\){2,}`,
  String.raw`%2e%2e(?:%2f|%5c)`,
  String.raw`%c0%ae`,
  String.raw`\b(?:eval|assert)\s*\(\s*\$`,
  String.raw`\betc/passwd\b`,
  String.raw`\bwindows\\\\win\.ini\b`,
];

export const RULE_IDS = {
  STRUCT_METHOD: "K1.method",
  STRUCT_URL_LEN: "K1.urllen",
  STRUCT_HEADER_FLOOD: "K1.hdrflood",
  STRUCT_CONTROL_CHARS: "K1.ctlchar",
  PROBE_PATH: "K2.probe",
  PAYLOAD: "K3.payload",
  CC_WINDOW: "K4.window",
  CC_BAN: "K4.ban",
  GLOBAL_QPS: "K5.qps",
} as const;

