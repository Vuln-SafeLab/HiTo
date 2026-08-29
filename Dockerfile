# syntax=docker/dockerfile:1
# NavSite 生产镜像:多阶段构建 Next.js standalone 产物。
# 构建:  docker build -t <你的用户名>/navsite:latest .
# 说明:  runner 里额外保留了 Prisma CLI 与引擎,使容器启动时(entrypoint)
#         与安装向导都能执行 `prisma migrate deploy`。

############################  base  ############################
FROM node:22-bookworm-slim AS base
# Prisma 运行需要 openssl;ca-certificates 用于 TLS
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
RUN corepack enable
ENV NEXT_TELEMETRY_DISABLED=1

############################  deps  ############################
FROM base AS deps
WORKDIR /app
# 扁平化 node_modules(而非 pnpm 默认的符号链接),这样 runner 才能选择性
# 拷贝 node_modules/prisma 等真实目录,而不是拷到一堆断掉的软链
RUN printf "node-linker=hoisted\n" > .npmrc
COPY package.json ./
COPY pnpm-lock.yaml* ./
COPY prisma ./prisma
# postinstall 会自动执行 prisma generate(依赖上面已拷入的 schema)
RUN pnpm install

############################  builder  ############################
FROM base AS builder
WORKDIR /app
COPY . .
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/.npmrc ./.npmrc
# standalone 输出显式开启(本地 Windows 构建没有 symlink 特权,保持默认输出即可)
ENV NEXT_OUTPUT=standalone
RUN pnpm build

############################  runner  ############################
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
# standalone 的 server.js 按 HOSTNAME/PORT 监听;容器里必须绑 0.0.0.0
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
RUN groupadd -r nodejs && useradd -r -g nodejs -m nextjs

# Next.js standalone 服务端 + 静态资源 + 语言包
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/messages ./messages

# Prisma:schema + migrations + CLI + 引擎 + 生成的 client
#   —— 让 entrypoint 与安装向导都能跑 migrate deploy
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

COPY docker/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh \
 && mkdir -p public/uploads data/backups \
 && chown -R nextjs:nodejs /app

USER nextjs
EXPOSE 3000
ENTRYPOINT ["./entrypoint.sh"]
CMD ["node", "server.js"]
