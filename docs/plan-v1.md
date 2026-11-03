# 窝事：快递功能第一版方案

> 2026-11-03 · 方案与原型阶段。原型中的姓名、地址、取件码均为虚构示例，不连接生产服务。

## 范围与判断

家人能在小程序查看待取快递、录入通知、查看详情并标记已取；Web 管理端补充编辑、按码完成、SMS 自动录入记录来源及白名单管理。SMS 接入属于 MVP。此轮交付方案、Prisma 草案和可浏览原型，不实现生产接口。旧 jarvis 的快递 REST 与短信流程只作功能参考；新系统以 PostgreSQL 为唯一业务数据源。新库从零开始，不从旧 jarvis 或飞书 Bitable 导入历史快递。

## 总体架构

| 位置 | 责任 | 第一版 |
| --- | --- | --- |
| `apps/web` | Next.js Web 管理端；shadcn/ui blocks 的侧栏、列表、详情、表单结构 | 现有模板保留，按原型逐步实现 |
| `apps/mini` | Taro + React 微信小程序；轻量取件流程 | 规划目录，MVP 建立 |
| `apps/api` | Node 服务，统一承载 Better Auth、微信登录桥接、快递 API 与 SMS ingest/处理 | 规划目录，MVP 建立 |
| `packages/db` | Prisma schema、migration、Prisma Client | 本轮提交 schema 草案 |
| `packages/contracts` | Zod 请求/响应契约及状态常量，供三端复用 | MVP 建立 |
| `packages/ui` | 现有 Web shadcn/ui 组件 | 现有目录 |

API 独立于 Next.js，可服务 Web、小程序与 iOS 捷径。开发与部署均使用 PostgreSQL；Prisma migration 管理结构变更。交互业务请求在 API 完成会话鉴权和白名单检查；SMS ingest 使用独立的设备密钥，不借用家庭成员会话。

### 生产部署目标

目标为个人生活向的阿里云北京机器 `101.200.151.162`，域名暂用 `share.libms.top`。现有 nginx 已在此域名提供静态站，当前静态原型位于 `https://share.libms.top/jarvis-family/`。推荐保留静态站的 `/` 和原型的 `/jarvis-family/`，将未来正式 Web 放在 `https://share.libms.top/family/`，API 对外放在 `https://share.libms.top/family/api/`。Web 设置 Next.js `basePath=/family`，静态资源与站内链接均带此前缀；Better Auth 的公开 URL 使用 `/family/api/auth`，Cookie Path 与回调路径按所选版本验证。服务只监听本机回环地址，PostgreSQL 不对公网开放。上线前检查现有 nginx 路由是否占用 `/family/`，复用现有有效证书并确认续期覆盖 `share.libms.top`。

在现有 HTTPS `server` 块中增加以下示意配置；保留原有 `location /`、静态站及 `/jarvis-family/` 规则。API 的 `proxy_pass` 尾部 `/api/` 会把公开前缀 `/family/api/` 替换为内部 `/api/`；Web 的 `proxy_pass` 不带 URI，保留 `/family/` 以匹配 Next.js `basePath`。`^~` 避免现有静态资源正则 location 抢先处理这两个路径，`/family/api/` 的最长前缀先于 `/family/` 命中。

```nginx
location = /family { return 308 /family/; }
location ^~ /family/api/ {
    proxy_pass http://127.0.0.1:3001/api/;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
location ^~ /family/ {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

改动前先备份当前 nginx 配置，用 `nginx -t` 校验后 reload，检查 `/`、`/jarvis-family/`、`/family/`、API 与 Auth 回调均走预期路径。小程序后台将 `https://share.libms.top` 配为合法 `request` 域名（如后续使用上传/下载或 WebView，再分别配置对应域名）；真机与正式版走 HTTPS，不使用服务器 IP。iOS 捷径请求同一域名下的 `/family/api/sms/ingest`。

## 数据模型

草案见 [`packages/db/prisma/schema.prisma`](../packages/db/prisma/schema.prisma)。`User`、`Session`、`Account`、`Verification` 满足 Better Auth 基础存储；最终字段需在安装锁定版本的 Better Auth 后用其 CLI 生成结果校对。`Whitelist` 按邮箱或微信身份建立邀请条目，`ExpressPickup` 记录通知、地点、取件码、来源、状态和操作人；`SmsIngest` 持久保存接入原文、去重键、处理状态及关联快递。首次 migration 只创建空表，不做旧库或 Bitable 导入。

依 2026-11-03 npm 稳定版锁定 `better-auth@1.4.21`、`prisma@7.10.1`、`@prisma/client@7.10.1`；npm 上的 Prisma `8.0.0-rc.*` 不用于 MVP。Better Auth 的 peerDependencies 支持 Prisma / Prisma Client `^5 || ^6 || ^7`。这三个包安装时精确锁入 lockfile，后续升级不得低于上述稳定版。UI 优先用 `@better-auth-ui/react`（当日约 1.7.x；若官方文档推荐包名变化则按文档），按安装时 npm latest 的稳定版锁入 lockfile。Better Auth 基础 schema 仍以锁定版本的 CLI 生成结果校对。

- `Whitelist` 的 email、微信 `appid + openid` 或 `unionid` 是可选身份键，至少填一种；管理员可按 `appid + openid` 或 `unionid` 录入微信白名单。草案已有 `wechatAppId`、`wechatOpenId`、`wechatUnionId` 字段；实现时须同步调整草案中的应用层校验说明。邀请与绑定在服务端事务中处理。微信 `openid` 只在同一 `appid` 下唯一；`unionid` 用作跨微信应用关联，不能假定每次返回。
- 取件码不是全局唯一，列表可有相同码；`done-by-code` 只对待取件记录操作，按 `updatedAt DESC, id DESC` 选一条，并在事务内锁定或使用条件更新防止并发重复完成。UI 在多条同码时应显示匹配目标供确认。
- `doneAt`、`doneById` 只由状态转换写入。按 ID 完成幂等：已完成则返回原记录，不重写完成时间。编辑取件信息会更新 `updatedAt`，不改变状态。删除不在 MVP 范围。
- 手工创建的 `source=MANUAL` 且 `createdById` 为会话用户；SMS 自动创建的 `source=SMS` 且 `createdById` 为空，通过 `SmsIngest.pickupId` 追溯来源。API 需校验这一约束。短信处理状态是独立流程状态，不等于取件状态。
- 取件码和原文属于家庭隐私：API 只返回给白名单成员；日志不打印原文、完整取件码和微信临时 `code`。备份按家庭数据处理。

## 鉴权与白名单

**Web**：Better Auth 邮箱密码登录，关闭公开注册。MVP 启动时用一次性种子步骤写入 `lsjustin@yeah.net` 的 `Whitelist(enabled=true, role=ADMIN)`，并通过受控初始化流程设置该管理员的邮箱密码账户；完成后首次用邮箱密码登录 Web，即可在 Web 显式绑定微信。后续成员由管理员录入白名单并发邀请/设置初始凭据。使用 `@better-auth-ui/react` + shadcn 组件做表单与会话 UI。Better Auth 服务端用 Prisma adapter；登录时和每次业务请求都检查有效白名单，移除成员后下一次请求立即拒绝。Web 同站 Cookie 为 HttpOnly、Secure、SameSite=Lax；生产环境设置强随机 `BETTER_AUTH_SECRET`、精确 `trustedOrigins`、数据库级限速。

**微信小程序「窝事」**：AppID 已确认为 `wxce94463a6a805e99`，服务端配置 `WECHAT_MINI_APPID=wxce94463a6a805e99`；原始 ID `gh_a696f88a7ea0` 仅作备案。AppSecret 尚未提供，上线前必须配置服务端 `WECHAT_MINI_SECRET`。未登录且无有效会话时，先用 `wx.login`/Taro 登录获取一次性 `code`，调用 `POST /api/auth/wechat-mini/identity`：API 用服务端 AppID/Secret 调 `jscode2session`，只返回该 code 对应的 `openid` 和有则返回的 `unionid`，不创建 User、Account、Session，不要求白名单，也不返回 `session_key`。接口限速，校验 code 一次性与失效错误，日志不打印 code 或身份值。小程序首页展示这些身份供复制给管理员；不能用客户端自行传入的身份值认证。已有有效会话且仍在白名单者直接进入正常快递列表。

管理员按 `appid + openid` 或 `unionid` 加入白名单后，用户重新取得 `wx.login` code，经 `POST /api/auth/wechat-mini/exchange` 登录；API 用服务端密钥调用 `jscode2session`，以返回的身份匹配 `Whitelist(enabled=true)`，随后通过经审查的 Better Auth 自定义登录端点/插件创建或关联 User、Account 和 Session。不能使用开放注册端点。若没有白名单，返回 `403 WHITELIST_REQUIRED`，不创建可用会话，客户端继续展示身份页与加白名单指引。

浏览器 Web 用 Cookie 保存会话；微信小程序没有可用的同站 Cookie，登录成功后 API 返回 Better Auth 官方 bearer / 无 Cookie 会话能力提供的 Bearer token（会话令牌）。小程序将令牌存入受控 storage，此后每个业务请求在 Header 中带 `Authorization: Bearer <token>`，服务端照常校验 Session 与白名单；不另造 JWT 旁路。退出时先调用服务端撤销会话，再清除本地 token。按 Better Auth 1.4.x 文档接入并在真机验证会话续期与失效。微信 `session_key` 永不下发客户端，也不入日志。

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

公共错误：未登录 `401`；未入白名单或被停用 `403 WHITELIST_REQUIRED`；校验失败 `400 VALIDATION_ERROR`；并发状态冲突 `409`。创建/修改约束：`address` 1–200 字、`pickupCode` 1–80 字、`rawInfo` 最多 4000 字；去首尾空格，不自动解析原文。创建可携带 `Idempotency-Key` 防重复点击；返回记录包含 `source`，详情可含 SMS 接收时间和处理记录 ID，原文仅对白名单成员显示。旧能力映射为创建、按状态列表、详情、更新、按 ID 完成、按码完成；旧 `taskId` 不进入新业务模型。

## SMS 接入（MVP）

对齐旧 jarvis 的 iOS 捷径 → `/api/sms/ingest` → AI 分类 → 快递创建链路。旧接口未鉴权、用短期 KV 去重，且后台任务只在进程内运行；新版用独立密钥、PG 持久去重和可恢复 worker 承接这条链路，不复用旧数据。捷径提交正文、发件人、短信接收时间和设备标识；服务端先用规则识别常见取件码/地点，只有规则不确定时才调用模型分类与结构化提取。模型选 `deepseek-flash`，经个人 9router 的 OpenAI 兼容入口 `https://token.libms.top/v1` 调用，该入口已有此模型 ID。仅确认是快递取件、地点和取件码齐全且置信度 ≥ 0.75 时自动建单，否则转 `REVIEW`；阈值在实现阶段用真实样本调整。AI 输出按同一契约二次校验，不能直接写库。短信原文仅发送到已选定的 9router 入口。

部署环境变量示例：`SMS_AI_BASE_URL=https://token.libms.top/v1`、`SMS_AI_MODEL=deepseek-flash`、`SMS_AI_API_KEY`（由 vault / 部署密钥注入，不在方案记录真实值）。管理员在部署环境分别配置和轮换 `SMS_INGEST_TOKEN` 与 `SMS_AI_API_KEY`；iOS 捷径只持有 ingest token，不持有 AI key。

| 方法/对外路径 | 用途 | 关键语义 |
| --- | --- | --- |
| `POST /family/api/sms/ingest` | iOS 捷径提交 | 内部路由 `POST /api/sms/ingest`；`Authorization: Bearer <SMS_INGEST_TOKEN>`；请求 `{ content, sender?, receivedAt, device, clientEventId? }`，`receivedAt` 为必填 ISO 8601；入库后 `202 { id, accepted: true, deduped: false }`，重复提交 `200 { id, accepted: true, deduped: true }` |
| `GET /family/api/sms/ingests?status=&cursor=` | 管理端查看处理记录 | 仅管理员会话及白名单可用；显示来源、时间、状态、关联快递及失败原因，原文仅详情展示 |
| `GET /family/api/sms/ingests/:id` | 管理端查看详情 | 仅管理员会话及白名单可用；包含原文、处理状态和关联快递 |
| `POST /family/api/sms/ingests/:id/retry` | 管理端重试 | 仅 `REVIEW` 记录可重试；保留原 ID，不创建第二条短信或快递 |
| `POST /family/api/sms/ingests/:id/link` | 管理端审核关联 | 请求 `{ pickupId }`；只对 `REVIEW` 记录生效，检查目标快递存在后关联并置 `LINKED_EXISTING`；若需补录，先调用手工创建接口再关联 |

`SMS_INGEST_TOKEN` 是与 Better Auth 密钥、用户 Session 分离的高熵随机密钥，部署时作为服务端环境变量配置，在捷径的 HTTPS 请求头中使用。服务端做恒定时间比较，拒绝无效密钥 `401`，鉴权前按 IP、鉴权后按设备限速；轮换时由管理员在部署环境替换密钥并同步更新捷径。日志、响应和原型均不展示密钥或完整短信。请求校验 `content` 非空且最多 4000 字、`device` 非空且最多 160 字、`sender` 最多 160 字、`clientEventId` 最多 128 字，并拒绝无效或明显未来的接收时间。捷径应为每条短信生成稳定 `clientEventId` 并在重试时复用；服务端以 `(device, clientEventId)` 唯一约束判重，另计算 `SHA-256(规范化设备|发件人|接收时间精确到秒|规范化正文)` 作为 `fingerprint`，PG 唯一约束处理并发重复。没有 `clientEventId` 也能按指纹判重；捷径必须传原短信 `receivedAt`，避免服务端当前时间导致重试失效。相同正文在不同接收时间是不同短信。唯一键命中且内容/指纹一致时返回既有记录，不重新分类或建单；同一个 `clientEventId` 对应不同内容时返回 `409 IDEMPOTENCY_CONFLICT`。

接入事务先持久写 `SmsIngest(RECEIVED)` 再返回 202；后台 worker 从 PG 原子领取 `RECEIVED`，处理成 `PROCESSING`，并在锁定该短信行的事务内创建 `ExpressPickup(source=SMS)`、回填 `pickupId`、置 `CREATED`。worker 重启后可重新领取超时的 `PROCESSING`（以 `updatedAt` 为租期依据）；最终写入事务必须复查该行状态和 `pickupId`，保证过期 worker 与新 worker 不重复建单。多条不同短信可关联同一快递。非快递短信置 `IGNORED`；解析失败、AI 错误、字段缺失或低置信度置 `REVIEW` 并记录不含原文的错误码，不自动创建残缺取件记录。管理员可查看原文、手工补录或重试。`REVIEW` 重试和人工关联通过状态条件更新，已关联或已创建时返回 `409`，避免并发覆盖。

手工录入一直可用，也可将 SMS 审核记录补录成快递并关联 `pickupId`（状态 `LINKED_EXISTING`）。若 SMS 解析结果与现有待取记录的地点及取件码规范化后完全一致且只匹配一条，关联该记录，不覆盖手工内容；多条或不确定匹配转 `REVIEW`，由管理员确认。手工记录的来源保持 `MANUAL`，详情可显示关联短信；短信创建的记录可由家人正常编辑、完成。这样去重针对同一短信，已有手工录入也不会被静默覆盖。

## 页面信息架构

### 小程序（Taro）

`启动 → 检查会话 → 无会话时 wx.login 探测身份并展示未登录首页 → 管理员加白名单 → 微信登录 → 快递列表`。未登录首页大号展示 `openid`，展示 `unionid`（无则显示「暂无」）、原始 ID 与 AppID，各有「复制」按钮；说明“把 openid 或 unionid 发给管理员加入白名单后再登录”。已有有效会话且白名单有效则直接进入列表，不停留在身份页。列表以“待取 / 已取”切换，卡片突出取件码与地点，底部固定“录入快递”。点击卡片进入详情：原文、创建时间、编辑入口和“标记已取”。待取列表每条卡片直接提供「标记已取」，一键完成，不要求输入取件码；按取件码完成仅保留在 Web 管理端。录入页只要求地点与码，原文可选；成功回到待取列表并提示。

### Web 管理端（shadcn blocks 风格）

登录页：简洁表单及无权限提示。管理框架：左侧“快递 / SMS 接入 / 家庭成员”，顶部家庭名称与账户菜单。快递页为筛选、搜索、列表及右侧详情面板，显示“手工 / 短信自动”来源；主按钮“录入快递”，行内“标记已取”，批量操作暂不做。SMS 接入页仅管理员可见，列出待审核、已创建、已关联、已忽略等处理记录并提供审核/重试入口；另有 iOS 捷径的接入说明，密钥只在安全配置流程中发放。家庭成员页管理白名单、状态与微信绑定（仅管理员）。原型中成员页只展示入口与拦截状态，不模拟真实管理提交。

## 原型与打开方式

- **交互演示**：直接用浏览器打开 [`prototypes/index.html`](../prototypes/index.html)，切换 Web / 小程序，体验未登录身份与复制、演示登录、白名单拒绝、列表、详情、录入、编辑及完成。所有数据只在浏览器内存中演示，刷新即重置。
- **设计画布**：[`designs/express-v1/project/canvas.json`](../designs/express-v1/project/canvas.json)，运行 `node .agents/skills/claude-design/scripts/artifact.mjs open designs/express-v1`；可浏览 Web 与小程序主要画面。
- **设计系统**：[`designs/family-system/project/design-system.json`](../designs/family-system/project/design-system.json)，运行 `node .agents/skills/claude-design-system/scripts/artifact.mjs open designs/family-system`；查看颜色、字体、间距及组件规范。

原型页面和画布均是评审稿，不会发送微信 code 或写入数据库。实际实现时以 API 契约及授权规则为准。

## 落地阶段

1. **MVP**：建立 `packages/db` 与 migration、`packages/contracts`、API；实现 Better Auth Web 登录、微信小程序登录桥接、白名单门禁；实现六个快递 API、SMS 独立密钥接入、PG 去重和持久处理、规则/AI 分类、自动建单与管理端审核；在 Taro 与 Web 接入列表、详情、录入、编辑、按 ID/码完成及来源展示。部署到 `share.libms.top/family/`，以真机验证微信登录、会话续期与失效、白名单撤销、短信重复提交和 worker 重启恢复。
2. **下一阶段**：通知提醒、成员权限细分。

## 上线前待准备

- 小程序 AppID 已确认，部署时配置 `WECHAT_MINI_APPID=wxce94463a6a805e99`；上线前仍须取得 AppSecret 并配置 `WECHAT_MINI_SECRET`。原始 ID `gh_a696f88a7ea0` 仅备案，不能用于 `jscode2session`。
- 核对现有 nginx `/family/` 路由，并在部署环境注入 Better Auth 与 SMS 的正式密钥。
