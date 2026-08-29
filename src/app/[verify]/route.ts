import { NextResponse, type NextRequest } from "next/server";
import { getVerificationFile } from "@/lib/ads";

/**
 * Dynamic ad-platform site-ownership file verification endpoint.
 * Platforms require a verification file at the site root (e.g. /google1234abcd.html, /baidu_verify_xxx.txt).
 * Here we look up by exact filename in admin config and return content verbatim —
 * all in memory / DB, never written to disk.
 *
 * Routing note: top-level single-segment dynamic [verify]; static segments (/admin /setup /api robots.txt sitemap)
 * win over it; the middleware matcher excludes dotted paths so this endpoint is not subject to CSP / install redirect.
 */
export const dynamic = "force-dynamic";

const MIME_BY_EXT: Record<string, string> = {
  html: "text/html; charset=utf-8",
  htm: "text/html; charset=utf-8",
  txt: "text/plain; charset=utf-8",
};

// Single-segment unknown paths land on this dynamic route instead of the app
// not-found page; render a styled 404 (with support credit) rather than a bare body.
function notFound(): NextResponse {
  return new NextResponse(
    `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>404 · HiTo</title>
<style>
:root{color-scheme:dark light}
*{margin:0;padding:0;box-sizing:border-box}
body{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"PingFang SC","Microsoft YaHei",sans-serif;
  background:#0b1120;color:#e2e8f0}
@media (prefers-color-scheme:light){body{background:#f1f5f9;color:#1e293b}}
.card{width:100%;max-width:520px;text-align:center;background:rgba(30,41,59,.55);
  border:1px solid rgba(148,163,184,.25);border-radius:20px;
  padding:clamp(28px,6vw,56px) clamp(20px,5vw,48px);backdrop-filter:blur(12px)}
@media (prefers-color-scheme:light){.card{background:rgba(255,255,255,.7);border-color:rgba(100,116,139,.3)}}
h1{font-size:clamp(22px,5vw,32px);font-weight:700;margin-bottom:10px}
p{font-size:15px;line-height:1.7;color:#94a3b8}
a{color:#7dd3fc;text-decoration:none}
a:hover{text-decoration:underline}
.credit{margin-top:24px;font-size:11px;color:#64748b}
</style>
</head>
<body>
<div class="card">
<h1>404</h1>
<p>你要找的页面不存在或已被移动。</p>
<p style="margin-top:12px"><a href="/">返回首页</a></p>
<p class="credit">由 VulnLab 提供技术支持</p>
</div>
</body>
</html>`,
    {
      status: 404,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
        "x-robots-tag": "noindex, nofollow",
      },
    }
  );
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ verify: string }> }
): Promise<NextResponse> {
  const { verify } = await context.params;

  // Matches the filename whitelist in validators: single segment, no path separator, no traversal.
  if (
    verify === "" ||
    verify.length > 120 ||
    verify !== decodeURIComponent(verify) ||
    /[\\/:*?"<>|]/.test(verify) ||
    verify.includes("..")
  ) {
    return notFound();
  }

  const hit = await getVerificationFile(verify);
  if (hit === null) return notFound();

  const ext = verify.includes(".") ? verify.split(".").pop()!.toLowerCase() : "";
  return new NextResponse(hit.content, {
    status: 200,
    headers: {
      "content-type": MIME_BY_EXT[ext] ?? "application/octet-stream",
      "cache-control": "no-store",
      "x-robots-tag": "noindex",
      "x-content-type-options": "nosniff",
      "content-disposition": `attachment; filename="${verify}"`,
    },
  });
}
