# Contributing to HiTo

Thank you for considering a contribution! HiTo is a self-hosted navigation portal with a real edge WAF — contributions to both features and security hardening are welcome.

中文说明：提交 PR 前请先跑通 `pnpm typecheck` 与 `pnpm lint`；安全类问题请勿公开发 issue，走 [SECURITY.md](.github/SECURITY.md) 的私密通道。

## Development Setup

```bash
pnpm install        # postinstall runs prisma generate
pnpm dev            # http://localhost:3000 — first visit enters /setup
```

Requirements: Node >= 20.9, pnpm 9 (corepack enabled).

## Before You Open a PR

```bash
pnpm typecheck      # must pass (strict TS)
pnpm lint           # must pass with zero warnings
pnpm build          # CI runs this too
```

## Guidelines

1. **One PR = one concern.** Keep diffs focused; no drive-by refactors.
2. **Commit style:** conventional commits, matching the existing history — `feat:`, `fix:`, `docs:`, `perf:`, `chore:` …
3. **Security-sensitive code** (auth, sessions, WAF engine, upload, SSRF guards) requires:
   - fail-safe behavior documented in comments
   - no new secrets logged or committed
   - input validated with zod at the boundary
4. **Edge runtime files** (`src/middleware.ts`, `src/lib/security/engine/*`) must not import `node:*` or Prisma.
5. **UI changes:** include a screenshot or GIF in the PR description.
6. **Docs:** user-facing changes update both `README.md` and `README.zh-CN.md`.

## Reporting Bugs / Suggesting Features

Use the issue templates. For anything with security impact, follow [Security Policy](.github/SECURITY.md) instead.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
