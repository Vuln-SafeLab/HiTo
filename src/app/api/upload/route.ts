import { randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth/guard";
import { getEnv } from "@/lib/env";
import { writeAudit } from "@/lib/security/audit";
import { getClientIdentifier } from "@/lib/security/ip";
import { isSameOrigin } from "@/lib/security/origin";
import { checkRate } from "@/lib/security/rate-limit";
import {
  extensionOf,
  isAllowedUpload,
  MAX_UPLOAD_BYTES,
  sniffImage,
} from "@/lib/security/upload";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getSessionUser();
  if (user === null) {
    return NextResponse.json({ ok: false, code: "unauthorized" }, { status: 401 });
  }
  const rate = await checkRate("upload", user.id);
  if (!rate.ok) {
    return NextResponse.json(
      { ok: false, code: "rateLimited" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }
  if (!isSameOrigin(request, "POST")) {
    return NextResponse.json({ ok: false, code: "forbidden" }, { status: 403 });
  }

  // Pre-flight size cap: reject BEFORE formData() fully buffers into memory (memory DoS).
  // Chunked requests have no Content-Length — the precheck would be bypassable, so they
  // must send it (browsers and standard HTTP clients always do for file uploads).
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (!Number.isFinite(declaredLength) || declaredLength <= 0) {
    return NextResponse.json({ ok: false, code: "uploadSize" }, { status: 411 });
  }
  if (declaredLength > MAX_UPLOAD_BYTES + 4096) {
    return NextResponse.json({ ok: false, code: "uploadSize" }, { status: 413 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, code: "uploadType" }, { status: 400 });
  }
  if (file.size === 0 || file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ ok: false, code: "uploadSize" }, { status: 413 });
  }

  // Triple check: extension whitelist + MIME match + magic bytes sniff
  const extension = extensionOf(file.name);
  if (!isAllowedUpload(extension, file.type)) {
    return NextResponse.json({ ok: false, code: "uploadType" }, { status: 415 });
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  if (!sniffImage(buffer, extension)) {
    return NextResponse.json({ ok: false, code: "uploadType" }, { status: 415 });
  }

  // Filename fully server-generated: user-supplied name used only for extension; no traversal
  const filename = `${randomBytes(8).toString("hex")}.${extension}`;
  const uploadDir = path.resolve(process.cwd(), getEnv().UPLOAD_DIR);
  await fs.mkdir(uploadDir, { recursive: true });
  await fs.writeFile(path.join(uploadDir, filename), buffer);

  await writeAudit({
    userId: user.id,
    username: user.username,
    action: "upload.create",
    targetType: "upload",
    targetId: filename,
    detail: { size: file.size, type: file.type },
    ip: await getClientIdentifier(request.headers),
    userAgent: request.headers.get("user-agent") ?? "",
  });

  // UPLOAD_DIR must live under public/ (default ./public/uploads) so URL is statically served
  return NextResponse.json({ ok: true, url: `/uploads/${filename}` });
}
