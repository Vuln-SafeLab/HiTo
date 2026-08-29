# HiTo · 工具导航站

精选工具/资源导航目录：卡片管理、广告投放、公告、SEO、多语言（7 语言）、数据导入导出、
内置 **Kun 1.0 边缘安全引擎**（WAF · PoW 防御验证 · 全球攻击地图 · 审计与封禁）。

## 技术栈

Next.js 15 (App Router) · React 19 · TypeScript 5 · Prisma 6 + SQLite · Tailwind CSS · next-intl · jose (JWT)

## 首次部署

### 1. 环境要求

- Node.js ≥ 20.9（推荐 22）
- pnpm 9（`corepack enable` 或 `npm i -g pnpm`）

### 2. 安装与启动

```bash
pnpm install
pnpm dev        # 开发模式，http://localhost:3000
```

首次访问会进入安装向导（4 步：环境自检 → 数据库 → 创建管理员 → 示例数据），
`.env` 由向导自动生成；也可先复制 `cp .env.example .env` 手工配置。

### 3. 生产部署

```bash
pnpm build
pnpm start      # http://localhost:3000
```

Docker（推荐，自动执行迁移）：

```bash
docker compose up -d          # 或 docker compose -f docker-compose.prod.yml up -d
```

详见 [docs/DOCKER.md](docs/DOCKER.md)。

### 4. 数据库

```bash
pnpm db:migrate   # 开发迁移
pnpm db:deploy    # 生产迁移（Docker entrypoint 自动执行）
pnpm db:seed      # 示例数据（可随时删除）
pnpm db:studio    # 数据库可视化管理
```

## 安全引擎（Kun 1.0）

- **WAF**：L1 结构校验 / L2 探针路径 / L3 载荷特征（SQLi · XSS · 穿越 · 双重编码），后台可逐条开关
- **防御验证**：QPS 阈值或手动触发进入防攻击模式，浏览器完成 PoW 挑战后放行（含纯 JS SHA-256 降级，HTTP 局域网环境可用）
- **攻击地图**：后台安全中心展示全球攻击来源点阵地图、实时攻击流与国家排行
- **防护配套**：CSP(nonce) · HSTS · 会话绑定 · 登录锁定 · IP 封禁 · 审计日志 · 速率限制
- 引擎模式：`SECURITY_ENGINE_MODE=off|log|block`（默认 log，确认无误拦后切 block）

## 环境变量

见 [.env.example](.env.example)（`AUTH_SECRET` 必须为 32+ 字符随机值，
`NEXT_PUBLIC_APP_URL` 改为实际访问地址，反代环境设 `TRUST_PROXY=true`）。

## License

见 [LICENSE](LICENSE)。
