# Jarvis Family：快递功能第一版方案

> 2026-11-03 · 方案与原型阶段。原型中的姓名、地址、取件码均为虚构示例，不连接生产服务。

## 范围与判断

家人能在小程序查看待取快递、录入通知、查看详情并标记已取；Web 管理端补充编辑、按码完成及白名单管理。此轮交付方案、Prisma 草案和可浏览原型，不实现生产接口。旧 jarvis 的快递 REST 能力是功能核对表；新系统以 PostgreSQL 为唯一业务数据源，不接入飞书。SMS 自动录入放到下一阶段。

## 总体架构

| 位置 | 责任 | 第一版 |
| --- | --- | --- |
| `apps/web` | Next.js Web 管理端；shadcn/ui blocks 的侧栏、列表、详情、表单结构 | 现有模板保留，按原型逐步实现 |
| `apps/mini` | Taro + React 微信小程序；轻量取件流程 | 规划目录，MVP 建立 |
| `apps/api` | Node 服务，统一承载 Better Auth、微信登录桥接和 `/api/express` | 规划目录，MVP 建立 |
| `packages/db` | Prisma schema、migration、Prisma Client | 本轮提交 schema 草案 |
| `packages/contracts` | Zod 请求/响应契约及状态常量，供三端复用 | MVP 建立 |
| `packages/ui` | 现有 Web shadcn/ui 组件 | 现有目录 |

推荐部署为 Web 与 API 同站点反向代理，`/api/*` 转给 API，减少浏览器跨站 Cookie 问题；小程序通过 HTTPS API 域名访问。API 独立于 Next.js，可服务两端。开发与部署均使用 PostgreSQL；Prisma migration 管理结构变更。所有业务读写都在 API 完成鉴权和白名单检查。

## 数据模型

草案见 [`packages/db/prisma/schema.prisma`](../packages/db/prisma/schema.prisma)。`User`、`Session`、`Account`、`Verification` 满足 Better Auth 基础存储；最终字段需在安装锁定版本的 Better Auth 后用其 CLI 生成结果校对。`Whitelist` 按邮箱或微信身份建立邀请条目，`ExpressPickup` 记录通知、地点、取件码、状态和操作人。

- `Whitelist` 的 email / 微信 `appid + openid` 是可选身份键，至少填一种；邀请与绑定在服务端事务中处理。微信 `openid` 只在同一 `appid` 下唯一；若能拿到 `unionid`，用作跨微信应用辅助关联，不能假定每次返回。
- 取件码不是全局唯一，列表可有相同码；`done-by-code` 只对待取件记录操作，按 `updatedAt DESC, id DESC` 选一条，并在事务内锁定或使用条件更新防止并发重复完成。UI 在多条同码时应显示匹配目标供确认。
- `doneAt`、`doneById` 只由状态转换写入。按 ID 完成幂等：已完成则返回原记录，不重写完成时间。编辑取件信息会更新 `updatedAt`，不改变状态。删除不在 MVP 范围。
- 取件码和原文属于家庭隐私：API 只返回给白名单成员；日志不打印原文、完整取件码和微信临时 `code`。备份按家庭数据处理。

## 鉴权与白名单

**Web**：Better Auth 邮箱密码登录，关闭公开注册；管理员先录入白名单，再发邀请/设置初始凭据。使用 `@better-auth-ui/react` + shadcn 组件做表单与会话 UI。Better Auth 服务端用 Prisma adapter；登录时和每次业务请求都检查有效白名单，移除成员后下一次请求立即拒绝。Web 同站 Cookie 为 HttpOnly、Secure、SameSite=Lax；生产环境设置强随机 `BETTER_AUTH_SECRET`、精确 `trustedOrigins`、数据库级限速。

**微信小程序**：`wx.login`/Taro 登录拿一次性 `code`，通过 `POST /api/auth/wechat-mini/exchange` 发给 API；API 用服务端保存的 `appid`/`secret` 调 `jscode2session`，得到 `openid`（可能有 `unionid`），检查 `Whitelist` 的微信身份且 `enabled=true`，随后通过一个经审查的 Better Auth 自定义登录端点/插件创建或关联 User、Account 和 Session。客户端不能自行传 `openid` 作为身份，也不能使用开放注册端点。若没有白名单，返回 `403 WHITELIST_REQUIRED`，不创建可用会话。小程序保存短期会话凭据于受控 storage，并通过 HTTPS 请求携带；具体采用 Better Auth 官方支持的 bearer 插件或同源会话桥接，MVP 要验证所选版本对小程序无 Cookie 环境的支持。退出时撤销服务端会话。微信 `session_key` 不返回客户端、不入日志。

**共用身份**：同一 API、同一 `User`/`Session` 表、同一业务授权中间件。管理员将 Web 邮箱与微信身份绑定到同一白名单条目；首次登录在事务中创建/关联 User。禁止仅凭邮箱字符串或客户端传入的微信昵称自动合并账户。管理员可在 Web 中显式绑定并审计。所有业务端点在 Session 认证后再检查 `Whitelist.enabled`；路由守卫仅改善体验，不作为授权边界。登录端点限速，校验微信 code 一次性与失效错误。

## 快递 API（`/api/express/pickups`）

请求与响应使用 JSON、ISO 8601 UTC 时间；展示时按设备时区格式化。状态值 `PENDING`、`DONE`。成功列表统一 `{ items, nextCursor }`，单条返回记录对象；错误统一 `{ error: { code, message } }`。默认列表仅 `PENDING`，按 `createdAt DESC, id DESC` 游标分页，默认 20 条，最多 100 条。

| 方法/路径 | 用途 | 关键请求/语义 |
| --- | --- | --- |
| `POST /` | 手工录入 | `rawInfo?`, `address`, `pickupCode`, `recipientName?`; `201` |
| `GET /?status=PENDING\|DONE&cursor=&limit=` | 列表 | 默认待取；可选 `q` 搜索地点/取件码 |
| `GET /:id` | 详情 | 不存在 `404` |
| `PATCH /:id` | 修改 | 可修改原文、地点、码、收件人；空 patch `400` |
| `POST /:id/done` | 按 ID 完成 | 幂等，返回更新后记录 |
| `POST /done-by-code` | 按码完成 | `{ pickupCode }`；仅匹配待取；无匹配 `404`；同码按最新更新项选取，响应带 `matchedPendingCount` 便于 UI 提醒 |

公共错误：未登录 `401`；未入白名单或被停用 `403 WHITELIST_REQUIRED`；校验失败 `400 VALIDATION_ERROR`；并发状态冲突 `409`。创建/修改约束：`address` 1–200 字、`pickupCode` 1–80 字、`rawInfo` 最多 4000 字；去首尾空格，不自动解析原文。创建可携带 `Idempotency-Key` 防重复点击。旧能力映射为创建、按状态列表、详情、更新、按 ID 完成、按码完成；旧 `taskId` 不迁入新业务模型。

## 页面信息架构

### 小程序（Taro）

`启动/微信登录 → 白名单拦截或快递列表`；列表以“待取 / 已取”切换，卡片突出取件码与地点，底部固定“录入快递”。点击卡片进入详情：原文、创建时间、编辑入口和“标记已取”。按码完成入口放在列表顶部，可输入码并在多条匹配时确认目标。录入页只要求地点与码，原文可选；成功回到待取列表并提示。

### Web 管理端（shadcn blocks 风格）

登录页：简洁表单及无权限提示。管理框架：左侧“快递 / 家庭成员”，顶部家庭名称与账户菜单。快递页为筛选、搜索、列表及右侧详情面板；主按钮“录入快递”，行内“标记已取”，批量操作暂不做。家庭成员页管理白名单、状态与微信绑定（仅管理员）。原型中成员页只展示入口与拦截状态，不模拟真实管理提交。

## 原型与打开方式

- **交互演示**：直接用浏览器打开 [`prototypes/index.html`](../prototypes/index.html)，切换 Web / 小程序，体验登录、白名单拒绝、列表、详情、录入、编辑及完成。所有数据只在浏览器内存中演示，刷新即重置。
- **设计画布**：[`designs/express-v1/project/canvas.json`](../designs/express-v1/project/canvas.json)，运行 `node .agents/skills/claude-design/scripts/artifact.mjs open designs/express-v1`；可浏览 Web 与小程序主要画面。
- **设计系统**：[`designs/family-system/project/design-system.json`](../designs/family-system/project/design-system.json)，运行 `node .agents/skills/claude-design-system/scripts/artifact.mjs open designs/family-system`；查看颜色、字体、间距及组件规范。

原型页面和画布均是评审稿，不会发送微信 code 或写入数据库。实际实现时以 API 契约及授权规则为准。

## 落地阶段

1. **MVP**：建立 `packages/db` 与 migration、`packages/contracts`、API；实现 Better Auth Web 登录、微信小程序登录桥接、白名单门禁；实现六个快递 API；在 Taro 与 Web 接入列表、详情、录入、编辑、按 ID/码完成。以真机验证微信登录、会话续期与失效、白名单撤销。
2. **下一阶段**：SMS 受信任接入与解析、重复通知去重、通知提醒、成员权限细分、导入旧数据。SMS 入口必须独立认证并具备幂等键，解析结果在写库前校验。

## 需在 MVP 前定案

微信小程序 `appid` 与服务域名、家庭管理员的初始邮箱及白名单初始化流程；Better Auth/Prisma 具体版本与小程序会话传输方案；旧数据是否导入及导入范围。这些不影响本轮原型评审。
