# 窝事

「窝事」是家庭快递管理项目：家人可查看、录入和完成待取快递，Web 管理端处理成员与短信接入。此仓库维护 Web、API 和共享包；微信小程序在[独立仓库](https://github.com/wujianguo/jarvis-family-mini)。

## 从这里开始

- [第一版方案](docs/plan-v1.md)：产品范围、API、登录和 SMS 契约。
- [部署说明](docs/deployment.md)：GitHub Actions、ECS、nginx 与生产配置。
- [交互原型](prototypes/index.html)：浏览器打开，使用虚构数据。
- [设计画布](designs/express-v1/project/canvas.json)与[设计系统](designs/family-system/project/design-system.json)。

## 本地开发

需要 Node.js 20.9+、pnpm 11.25.0 和 PostgreSQL。先按 [`.env.example`](.env.example) 配置本地环境，并将变量导出到启动命令所在的 shell；API 从进程环境读取配置。

```bash
pnpm install
pnpm --filter @workspace/db generate
pnpm --filter @workspace/db migrate
pnpm dev
```

Web 使用 `/family` 路径；API 默认监听本机 `3001` 端口。根目录还提供 `pnpm build`、`pnpm lint`、`pnpm format`、`pnpm typecheck`；单独开发可用 `pnpm --filter web dev` 或 `pnpm --filter api dev`。

共享 UI 组件在 `packages/ui`；按需使用 `pnpm dlx shadcn` 添加。
