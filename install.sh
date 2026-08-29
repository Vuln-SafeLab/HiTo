#!/usr/bin/env bash
# HiTo 本地安装脚本（SQLite 版）
#   ./install.sh            # 安装依赖 + 初始化数据库 + 启动开发服务器
#   ./install.sh --no-run   # 只装依赖与初始化，不启动
set -euo pipefail

NO_RUN=0
for arg in "$@"; do
  case "$arg" in
    --no-run) NO_RUN=1 ;;
    -h|--help) echo "Usage: ./install.sh [--no-run]"; exit 0 ;;
  *) echo "Unknown arg: $arg"; exit 1 ;;
esac
done

cd "$(dirname "$0")"

info() { printf "\033[36m[install]\033[0m %s\n" "$*"; }
ok()   { printf "\033[32m[ok]\033[0m %s\n" "$*"; }

# 步骤 1：依赖
if [ ! -d node_modules ]; then
  info "installing dependencies (pnpm)…"
  pnpm install
else
  ok "node_modules present, skipping pnpm install"
fi

# 步骤 2：环境变量（缺失则生成并写入 .env；已有则保留不动）
if [ ! -f .env ] || ! grep -q "^AUTH_SECRET=" .env; then
  info "generating .env with random secrets…"
  {
    echo "DATABASE_URL=\"file:./data/navsite.db?connection_limit=1\""
    echo "AUTH_SECRET=\"$(openssl rand -base64 48 | tr -d '\n')\""
    echo "ANALYTICS_SALT=\"$(openssl rand -base64 16 | tr -d '\n')\""
    echo "NEXT_PUBLIC_APP_URL=\"http://localhost:3000\""
    echo "RATE_LIMIT_DRIVER=\"db\""
  } >> .env
  ok ".env written"
else
  ok ".env already configured, keeping it"
fi

# 步骤 3：Prisma client + 数据库迁移（幂等）
info "prisma generate + migrate deploy…"
pnpm db:generate
mkdir -p prisma/data
pnpm db:deploy
ok "database ready at prisma/data/navsite.db"

# 步骤 4：启动
if [ "$NO_RUN" -eq 1 ]; then
  ok "done. Start later with: pnpm dev"
  exit 0
fi

info "starting dev server on http://localhost:3000 …"
info "first run will open the /setup wizard (create the admin there)."
exec pnpm dev
