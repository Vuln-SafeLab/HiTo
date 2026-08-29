import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// 与请求无关的静态安全头：对包括 API 与静态资源在内的全部路由输出；
// 需要逐请求 nonce 的 CSP 与 HSTS 由 middleware 负责
const SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
];

const nextConfig: NextConfig = {
  // 不泄露框架指纹
  poweredByHeader: false,
  // 产出自包含 server.js,Docker 镜像只需拷贝 .next/standalone,体积大幅缩小
  // 仅在显式声明时启用：Windows 本地无 symlink 特权会 EPERM，本地 `next start` 用默认输出
  ...(process.env.NEXT_OUTPUT === "standalone" ? { output: "standalone" as const } : {}),
  headers() {
    return Promise.resolve([{ source: "/(.*)", headers: SECURITY_HEADERS }]);
  },
  experimental: {
    // forbidden()：EDITOR 访问安全中心等页面时返回真正的 HTTP 403
    authInterrupts: true,
    // 导入功能承诺 5000 卡片/5MB 载荷：默认 1MB 的 Action body 上限会让功能超限
    serverActions: { bodySizeLimit: "12mb" },
  },
  images: {
    remotePatterns: [
      // seed 示例图固定用 picsum；用户自填的第三方图源走后台上传或原生 <img>
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "fastly.picsum.photos" },
    ],
  },
};

export default withNextIntl(nextConfig);
