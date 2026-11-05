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

Web 的「录入快递」支持只粘贴短信正文或只上传一张通知截图。规则先解析短信，不确定时使用 `SMS_AI_*`；截图识别需要 `SMS_AI_MODEL` 指向支持图片输入的 OpenAI 兼容模型。解析不足会显示可编辑预览，确认后才保存。API 入口见 [服务实现](apps/api/src/server.ts)。

iOS 捷径调用 `POST /family/api/sms/ingest` 时提交 `{ content, device, sender?, receivedAt?, clientEventId? }`，并使用 `Authorization: Bearer <SMS_INGEST_TOKEN>`。`receivedAt` 可省略；省略、空值或无效值会使用服务端收到请求的时间。合法值须为带 offset 的 ISO datetime，晚于服务端时间 5 分钟会被拒绝。建议为每条短信提供稳定的 `clientEventId`，以便省略时间时仍能识别重试。

登录后点侧栏底部头像，可进入 `/family/settings/account` 修改个人资料，或进入 `/family/settings/security` 创建和撤销自己的 API Key。新 Key 只显示一次；密钥数据由 Better Auth 管理，数据库迁移随 `packages/db` 的现有部署流程执行。短信列表仅显示接收时间与内容，完整处理信息仍在详情中查看。
