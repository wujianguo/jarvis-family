<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# 窝事 · coding agent 指引

本仓是「窝事」家庭快递 monorepo，包含 Web 与 API；微信小程序在独立的 [jarvis-family-mini](https://github.com/wujianguo/jarvis-family-mini) 仓库。

## 找到工作位置

- `apps/web`：Next.js Web；`apps/api`：Express API。
- `packages/db`：Prisma 数据库；`packages/contracts`：共享契约；`packages/ui`：共享组件。其余 `packages/*` 是构建配置。

## 按任务读取

- 改产品流程、快递 API、SMS ingest 或 Better Auth / 微信登录时，先读 [`docs/plan-v1.md`](docs/plan-v1.md) 中对应章节，再对照现有实现。
- 改 ECS、nginx、CI 或生产环境配置时，先读 [`docs/deployment.md`](docs/deployment.md) 和 [`.github/workflows/main.yml`](.github/workflows/main.yml)。
- 增改环境变量时，先核对 [`.env.example`](.env.example) 的名称与用途，并同步部署文档；密钥只放服务器或 CI Secret，不进入前端或 `NEXT_PUBLIC_*`。

## 开发与完成

1. 在仓库根目录用 `pnpm`；按改动范围运行根脚本 `build`、`dev`、`lint`、`format`、`typecheck`，或用 `pnpm --filter <包名> <script>` 缩小范围（包名见各 `package.json`）。
2. 改 API、共享契约或数据库后，对受影响包运行 `typecheck`；改 Web 后运行 `pnpm --filter web typecheck`。提交前按改动范围检查 lint 与格式。
3. 推送 `main` 会触发 [GitHub Actions](.github/workflows/main.yml) 检查并部署 Docker 镜像。部署使用 Repository Variables `DEPLOY_HOST`、`PUBLIC_ORIGIN`、`PUBLIC_API_BASE` 和服务器 `.env`；具体配置与验证步骤见 [`docs/deployment.md`](docs/deployment.md)。
