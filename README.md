# shadcn/ui monorepo template

## 快递功能第一版方案与原型

- [方案文档](docs/plan-v1.md)
- [交互演示](prototypes/index.html)：浏览器直接打开，切换 Web / 小程序
- [设计画布](designs/express-v1/project/canvas.json)：`node .agents/skills/claude-design/scripts/artifact.mjs open designs/express-v1`
- [设计系统](designs/family-system/project/design-system.json)：`node .agents/skills/claude-design-system/scripts/artifact.mjs open designs/family-system`

交互演示使用浏览器内的虚构数据，刷新后重置；尚未连接 API 或微信登录。

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
import { Button } from "@workspace/ui/components/button";
```
