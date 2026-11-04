# shadcn/ui monorepo template

## 窝事：快递功能第一版方案与原型

- [方案文档](docs/plan-v1.md)
- [交互演示](prototypes/index.html)：浏览器直接打开，或访问 `PUBLIC_ORIGIN` 对应站点的 `/jarvis-family/`，切换 Web / 小程序
- [设计画布](designs/express-v1/project/canvas.json)：`node .agents/skills/claude-design/scripts/artifact.mjs open designs/express-v1`
- [设计系统](designs/family-system/project/design-system.json)：`node .agents/skills/claude-design-system/scripts/artifact.mjs open designs/family-system`
- [窝事小程序独立仓库](https://github.com/wujianguo/jarvis-family-mini)：源码、构建和体验版上传 CI 在此维护。

交互演示使用浏览器内的虚构数据，刷新后重置；尚未连接 API 或微信登录。

微信小程序「窝事」的 AppID 由环境变量 `WECHAT_MINI_APPID` 配置，原始 ID 由 `WECHAT_MINI_ORIGINAL_ID` 配置。服务端 AppSecret 由 `WECHAT_MINI_SECRET` 配置。未登录首页将展示可复制的微信身份，供管理员按 `appid + openid` 或 `unionid` 加入白名单；原型只用虚构数据演示。MVP 管理员邮箱由 `ADMIN_EMAIL` 配置，初始化白名单后用邮箱密码首次登录并在 Web 绑定微信。具体方案见上方文档。

第一版范围包括 iOS 捷径短信接入：短信经独立密钥鉴权后进入 API，PostgreSQL 持久去重，规则优先、规则不确定时用 `SMS_AI_MODEL=deepseek-flash` 分类，达到 0.75 置信度且字段齐全才自动创建快递；无法解析的记录供管理端审核。短信接口规划为 `POST <PUBLIC_API_BASE>/sms/ingest`，目前仅有方案与 Prisma 草案，尚未上线。

目标部署在 `DEPLOY_HOST` 指定的服务器，复用 `PUBLIC_ORIGIN` 对应站点的 nginx 与 HTTPS。现有静态站 `/` 和已部署的原型 `/jarvis-family/` 保留；未来正式 Web 使用 `/family/`，API 使用 `/family/api/`。小程序需把 `PUBLIC_ORIGIN` 的 HTTPS 域名加入合法 request 域名。新 PostgreSQL 库从零开始，不导入旧 jarvis 或飞书 Bitable 历史快递；具体反代、鉴权和数据设计见[方案文档](docs/plan-v1.md)。

This is a Next.js monorepo template with shadcn/ui.

## Adding components

To add components to your app, run the following command at the root of your `web` app:

```bash
pnpm dlx shadcn@latest add button -c apps/web
```

This will place the ui components in the `packages/ui/src/components` directory.

## Using components

To use the components in your app, import them from the `ui` package.

```tsx
import { Button } from "@workspace/ui/components/button"
```
