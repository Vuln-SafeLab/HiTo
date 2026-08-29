#!/bin/sh
# 容器启动脚本:数据库就绪后先跑迁移,再启动应用。
# 迁移失败不致命(安装向导内部还会再跑一次),但会重试等待 MySQL 起来。
set -e

echo "[entrypoint] HiTo starting…"

if [ -n "${DATABASE_URL:-}" ]; then
  echo "[entrypoint] applying migrations (waiting for the database)…"
  i=1
  while [ "$i" -le 30 ]; do
    if node node_modules/prisma/build/index.js migrate deploy; then
      echo "[entrypoint] migrations applied."
      break
    fi
    echo "[entrypoint] database not ready ($i/30), retrying in 2s…"
    i=$((i + 1))
    sleep 2
  done
else
  echo "[entrypoint] DATABASE_URL not set — the /setup wizard will configure the database."
fi

echo "[entrypoint] launching server on ${HOSTNAME}:${PORT}"
exec "$@"
