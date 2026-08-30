export interface SetupStatus {
  installed: boolean;
  checks: {
    node: { ok: boolean; version: string };
    envWrite: { ok: boolean };
    uploadWrite: { ok: boolean };
    vars: { databaseUrl: boolean; authSecret: boolean };
  };
  db: {
    configured: boolean;
    migrated: boolean;
    adminExists: boolean;
  };
}

export interface ApiError {
  ok: false;
  code: string;
  detail?: string;
  /** test-connection returns human-readable probe errors as `message` */
  message?: string;
}

/** Prefer detail, fall back to message — surfacing the real cause (e.g. "database is locked") beats a generic retry hint. */
export function apiErrorText(error: ApiError): string | null {
  if (typeof error.detail === "string" && error.detail.trim() !== "") return error.detail;
  if (typeof error.message === "string" && error.message.trim() !== "") return error.message;
  return null;
}

export async function postJson<TSuccess extends { ok: true }>(
  url: string,
  body: unknown
): Promise<TSuccess | ApiError> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data: unknown = await response.json().catch(() => null);
    if (typeof data !== "object" || data === null || !("ok" in data)) {
      return { ok: false, code: "generic" };
    }
    return data as TSuccess | ApiError;
  } catch {
    return { ok: false, code: "generic" };
  }
}

const KNOWN_ERROR_CODES = new Set([
  "generic",
  "dbUnreachable",
  "dbAuth",
  "dbNotFound",
  "dbUnknown",
  "rateLimited",
  "unauthorized",
  "forbidden",
  "alreadyInstalled",
  "envWriteFailed",
  "setupLocked",
]);

/** Unknown codes fall back to errors.generic — never render internal error codes to users */
export function errorMessageKey(code: string): string {
  return KNOWN_ERROR_CODES.has(code) ? `errors.${code}` : "errors.generic";
}
