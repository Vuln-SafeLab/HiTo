import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

const DEFAULT_BODY = "# ads.txt not configured\n";

/**
 * ads.txt route: body stored in SystemConfig, served as text/plain.
 */
export async function GET(): Promise<Response> {
  let body: string;
  try {
    const row = await getDb().systemConfig.findUnique({
      where: { key: "ads.txt.content" },
      select: { value: true },
    });
    body =
      row !== null && row.value.trim() !== ""
        ? row.value.endsWith("\n")
          ? row.value
          : row.value + "\n"
        : DEFAULT_BODY;
  } catch {
    body = DEFAULT_BODY;
  }
  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
