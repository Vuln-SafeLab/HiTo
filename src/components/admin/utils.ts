// Server Action error code -> i18n key mapping; unknown codes fall back to errors.generic
const ERROR_KEY_MAP: Record<string, string> = {
  unauthorized: "errors.unauthorized",
  forbidden: "errors.forbidden",
  rateLimited: "errors.rateLimited",
  generic: "errors.generic",
  slugTaken: "admin.categories.slugTaken",
  categoryNotEmpty: "admin.categories.notEmpty",
  fetchFailed: "admin.cards.fetchFailed",
  lastAdmin: "admin.users.lastAdmin",
  userExists: "admin.users.exists",
  invalidFile: "admin.data.invalidFile",
  providerExists: "admin.ads.providerExists",
};

export function errorKeyFor(code: string): string {
  return ERROR_KEY_MAP[code] ?? "errors.generic";
}

export function downloadText(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

// Best-effort name -> slug; CJK chars are stripped, user fills the rest manually
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}
