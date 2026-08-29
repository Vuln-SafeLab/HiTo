import path from "node:path";
import { z } from "zod";

// .env leaves empty vars as ""; running min(32) on "" would crash boot in "not yet installed" state
const emptyToUndefined = (value: unknown): unknown =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

// Sample placeholders would pass length check; JWT would be signed with a publicly known string
const SECRET_PLACEHOLDER = /replace[_-]?me|changeme|change[-_]?me|placeholder|^example|^sample$/i;

function rejectPlaceholder(value: string): string {
  if (SECRET_PLACEHOLDER.test(value.trim())) {
    throw new Error("value looks like a public placeholder — generate a real secret (openssl rand -base64 48)");
  }
  return value;
}

const envSchema = z.object({
  DATABASE_URL: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .startsWith("file:", "DATABASE_URL must be a file: SQLite connection string (e.g. file:./data/navsite.db)")
      .optional()
  ),
  AUTH_SECRET: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .transform(rejectPlaceholder)
      .pipe(z.string().min(32, "AUTH_SECRET must be at least 32 characters"))
      .optional()
  ),
  AUTH_ACCESS_TTL: z.coerce.number().int().positive().default(900),
  AUTH_REFRESH_TTL: z.coerce.number().int().positive().default(1209600),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  ANALYTICS_SALT: z.preprocess(
    emptyToUndefined,
    z.string().transform(rejectPlaceholder).pipe(z.string().min(8)).optional()
  ),
  // TRUST_PROXY=false (default) bare-exposed: X-Forwarded-For is client-controlled; ignore it
  TRUST_PROXY: z.preprocess(emptyToUndefined, z.enum(["true", "false"]).default("false")),
  UPLOAD_DIR: z.string().default("./public/uploads"),
  BACKUP_DIR: z.string().default("./data/backups"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  /** memory=single-instance, db=multi-instance shared counters */
  RATE_LIMIT_DRIVER: z.preprocess(
    emptyToUndefined,
    z.enum(["memory", "db"]).default("memory")
  ),
  /** "lng,lat" of the protected node for attack-map arcs (default: Beijing) */
  WAF_SERVER_GEO: z.preprocess(
    emptyToUndefined,
    z.string().regex(/^-?\d{1,3}(\.\d+)?\s*,\s*-?\d{1,2}(\.\d+)?$/).optional()
  ),
});

let validatedOnce = false;
function validatePathSafety(env: Env): void {
  if (validatedOnce) return;
  const cwd = process.cwd();
  const publicRoot = path.resolve(cwd, "public");
  const uploadResolved = path.resolve(cwd, env.UPLOAD_DIR);
  if (!uploadResolved.startsWith(publicRoot + path.sep) && uploadResolved !== publicRoot) {
    console.warn(
      `[config] UPLOAD_DIR (${env.UPLOAD_DIR}) 不在 public/ 内——` +
        "上传产物将无法通过 /uploads 静态访问（Next 仅托管 public/）"
    );
  }
  const backupResolved = path.resolve(cwd, env.BACKUP_DIR);
  if (backupResolved.startsWith(publicRoot + path.sep) || backupResolved === publicRoot) {
    throw new Error(
      `Invalid environment configuration — BACKUP_DIR must not be inside public/ (HTTP-readable). Got: ${env.BACKUP_DIR}`
    );
  }
  validatedOnce = true;
}

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached === null) {
    const parsed = envSchema.safeParse(process.env);
    if (!parsed.success) {
      const detail = parsed.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ");
      throw new Error(`Invalid environment configuration — ${detail}`);
    }
    validatePathSafety(parsed.data);
    cached = parsed.data;
  }
  return cached;
}

export function resetEnvCache(): void {
  cached = null;
  validatedOnce = false;
}

export function isDatabaseConfigured(): boolean {
  const url = process.env.DATABASE_URL;
  return typeof url === "string" && url.trim().length > 0;
}

export function isAuthConfigured(): boolean {
  const secret = process.env.AUTH_SECRET;
  return typeof secret === "string" && secret.trim().length >= 32;
}
