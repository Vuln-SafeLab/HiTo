export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

// SVG intentionally excluded — it can carry inline-script XSS
const ALLOWED: Record<string, string[]> = {
  png: ["image/png"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  webp: ["image/webp"],
  ico: ["image/x-icon", "image/vnd.microsoft.icon"],
};

export function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot === -1 ? "" : filename.slice(dot + 1).toLowerCase();
}

export function isAllowedUpload(extension: string, mime: string): boolean {
  const mimes = ALLOWED[extension];
  return mimes !== undefined && mimes.includes(mime.toLowerCase());
}

function startsWithBytes(buffer: Buffer, bytes: number[], offset = 0): boolean {
  if (buffer.length < offset + bytes.length) return false;
  return bytes.every((byte, index) => buffer[offset + index] === byte);
}

// Extension and Content-Type are both client-spoofable; only the file header is authoritative
export function sniffImage(buffer: Buffer, extension: string): boolean {
  switch (extension) {
    case "png":
      return startsWithBytes(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "jpg":
    case "jpeg":
      return startsWithBytes(buffer, [0xff, 0xd8, 0xff]);
    case "webp":
      return (
        startsWithBytes(buffer, [0x52, 0x49, 0x46, 0x46]) && // "RIFF"
        startsWithBytes(buffer, [0x57, 0x45, 0x42, 0x50], 8) // "WEBP"
      );
    case "ico":
      return startsWithBytes(buffer, [0x00, 0x00, 0x01, 0x00]);
    default:
      return false;
  }
}
