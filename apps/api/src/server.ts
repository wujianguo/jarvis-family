import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express"
import { db, SmsIngestStatus, type Prisma } from "@workspace/db"
import {
  pickupInput,
  pickupPatch,
  smsInput,
  whitelistInput,
} from "@workspace/contracts"
import { auth } from "./auth.js"
import { hashPassword } from "better-auth/crypto"
import { createHash, timingSafeEqual } from "node:crypto"
import { z } from "zod"
import { parseNotice } from "./notice-parser.js"

type Handler = (req: Request, res: Response) => Promise<void>
const run =
  (fn: Handler) => (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next)
  }
const app = express()
app.disable("x-powered-by")
app.set("trust proxy", "loopback")
app.use("/api/auth", (req, res, next) => {
  if (
    req.path === "/wechat-mini/identity" ||
    req.path === "/wechat-mini/exchange"
  )
    return next()
  if (req.path === "/sign-up/email")
    return res.status(403).json({
      error: { code: "REGISTRATION_DISABLED", message: "请联系管理员" },
    })
  let body = ""
  req.on("data", (chunk) => {
    body += chunk
    if (body.length > 20000) req.destroy()
  })
  req.on("end", async () => {
    try {
      if (req.path === "/sign-in/email" && req.method === "POST") {
        const email = String(JSON.parse(body).email || "").toLowerCase()
        const white = await db.whitelist.findUnique({ where: { email } })
        if (!white?.enabled)
          return res.status(403).json({
            error: {
              code: "WHITELIST_REQUIRED",
              message: "未加入家庭白名单",
            },
          })
      }
      const base =
        process.env.BETTER_AUTH_URL || "http://localhost:3001/api/auth"
      const request = new Request(`${base}${req.url}`, {
        method: req.method,
        headers: req.headers as HeadersInit,
        ...(["GET", "HEAD"].includes(req.method) ? {} : { body }),
      })
      const response = await auth.handler(request)
      res.status(response.status)
      response.headers.forEach((value, key) => {
        if (key !== "set-cookie") res.setHeader(key, value)
      })
      const cookies = response.headers.getSetCookie()
      if (cookies.length) res.setHeader("set-cookie", cookies)
      res.end(Buffer.from(await response.arrayBuffer()))
    } catch {
      res
        .status(400)
        .json({ error: { code: "VALIDATION_ERROR", message: "请求无效" } })
    }
  })
})
app.use("/api/express/pickups/from-notice", express.json({ limit: "5mb" }))
app.use(express.json({ limit: "16kb" }))
const fail = (res: Response, status: number, code: string, message: string) =>
  res.status(status).json({ error: { code, message } })
const smallRate = new Map<string, { n: number; t: number }>()
function limited(key: string, max: number, ms: number) {
  const now = Date.now(),
    v = smallRate.get(key)
  if (!v || v.t < now) {
    smallRate.set(key, { n: 1, t: now + ms })
    return false
  }
  v.n++
  return v.n > max
}
async function principal(req: Request, res: Response, admin = false) {
  const session = await auth.api.getSession({
    headers: new Headers(req.headers as HeadersInit),
  })
  if (!session) {
    fail(res, 401, "UNAUTHENTICATED", "请先登录")
    return null
  }
  const white = await db.whitelist.findFirst({
    where: { userId: session.user.id, enabled: true },
  })
  if (!white) {
    fail(res, 403, "WHITELIST_REQUIRED", "未加入家庭白名单")
    return null
  }
  if (admin && white.role !== "ADMIN") {
    fail(res, 403, "ADMIN_REQUIRED", "仅管理员可操作")
    return null
  }
  return { user: session.user, white }
}
const miniId = process.env.WECHAT_MINI_APPID?.trim()
if (process.env.NODE_ENV === "production" && !miniId)
  throw new Error("WECHAT_MINI_APPID is required in production")
app.get("/api/public-config", (_req, res) => {
  if (!miniId) return fail(res, 503, "WECHAT_NOT_CONFIGURED", "微信配置缺失")
  res.json({ wechatMiniAppId: miniId })
})
async function wechat(code: string) {
  if (!miniId || !process.env.WECHAT_MINI_SECRET)
    throw new Error("WECHAT_NOT_CONFIGURED")
  const url = new URL("https://api.weixin.qq.com/sns/jscode2session")
  url.searchParams.set("appid", miniId)
  url.searchParams.set("secret", process.env.WECHAT_MINI_SECRET)
  url.searchParams.set("js_code", code)
  url.searchParams.set("grant_type", "authorization_code")
  const r = await fetch(url)
  const data = (await r.json()) as {
    openid?: string
    unionid?: string
    errcode?: number
  }
  if (!r.ok || data.errcode || !data.openid)
    throw new Error("WECHAT_CODE_INVALID")
  return { openid: data.openid, unionid: data.unionid }
}
app.post(
  "/api/auth/wechat-mini/identity",
  run(async (req, res) => {
    if (limited(`identity:${req.ip}`, 10, 60000)) {
      fail(res, 429, "RATE_LIMITED", "请稍后再试")
      return
    }
    const parsed = z
      .object({ code: z.string().min(1).max(200) })
      .safeParse(req.body)
    if (!parsed.success) {
      fail(res, 400, "VALIDATION_ERROR", "微信 code 无效")
      return
    }
    try {
      const id = await wechat(parsed.data.code)
      res.json({
        appid: miniId,
        openid: id.openid,
        unionid: id.unionid || null,
      })
    } catch {
      fail(res, 400, "WECHAT_CODE_INVALID", "微信登录凭据已失效，请重试")
    }
  })
)
app.post(
  "/api/auth/wechat-mini/exchange",
  run(async (req, res) => {
    if (limited(`exchange:${req.ip}`, 10, 60000)) {
      fail(res, 429, "RATE_LIMITED", "请稍后再试")
      return
    }
    const parsed = z
      .object({ code: z.string().min(1).max(200) })
      .safeParse(req.body)
    if (!parsed.success) {
      fail(res, 400, "VALIDATION_ERROR", "微信 code 无效")
      return
    }
    let id: Awaited<ReturnType<typeof wechat>>
    try {
      id = await wechat(parsed.data.code)
    } catch {
      fail(res, 400, "WECHAT_CODE_INVALID", "微信登录凭据已失效，请重试")
      return
    }
    const white = await db.whitelist.findFirst({
      where: {
        enabled: true,
        OR: [
          { wechatAppId: miniId, wechatOpenId: id.openid },
          ...(id.unionid ? [{ wechatUnionId: id.unionid }] : []),
        ],
      },
    })
    if (!white) {
      fail(res, 403, "WHITELIST_REQUIRED", "请先把身份发给管理员加入白名单")
      return
    }
    const userId = await db.$transaction(async (tx) => {
      const row = await tx.whitelist.findUnique({ where: { id: white.id } })
      if (!row?.enabled) throw new Error("WHITELIST_REQUIRED")
      if (!row.wechatOpenId)
        await tx.whitelist.update({
          where: { id: row.id },
          data: {
            wechatAppId: miniId,
            wechatOpenId: id.openid,
            wechatUnionId: id.unionid || row.wechatUnionId,
          },
        })
      let uid = row.userId
      if (!uid) {
        const user = await tx.user.create({
          data: {
            name: row.displayName,
            email: `wx-${miniId}-${id.openid}@invalid.local`,
          },
        })
        uid = user.id
        await tx.whitelist.update({
          where: { id: row.id },
          data: { userId: uid },
        })
      }
      const account = await tx.account.findUnique({
        where: {
          providerId_accountId: {
            providerId: `wechat-mini:${miniId}`,
            accountId: id.openid,
          },
        },
      })
      if (account && account.userId !== uid)
        throw new Error("IDENTITY_CONFLICT")
      if (!account)
        await tx.account.create({
          data: {
            providerId: `wechat-mini:${miniId}`,
            accountId: id.openid,
            userId: uid,
          },
        })
      return uid
    })
    const context = await auth.$context
    const session = await context.internalAdapter.createSession(userId, false)
    res.json({
      token: session.token,
      expiresAt: session.expiresAt.toISOString(),
    })
  })
)
app.get(
  "/api/me",
  run(async (req, res) => {
    const p = await principal(req, res)
    if (p)
      res.json({
        user: { id: p.user.id, email: p.user.email, name: p.user.name },
        role: p.white.role,
      })
  })
)
app.post(
  "/api/logout",
  run(async (req, res) => {
    const p = await principal(req, res)
    if (!p) return
    const token = req.headers.authorization?.replace(/^Bearer /i, "")
    if (token)
      await db.session.deleteMany({ where: { token, userId: p.user.id } })
    res.json({ ok: true })
  })
)
const base = "/api/express/pickups"
app.post(
  base,
  run(async (req, res) => {
    const p = await principal(req, res)
    if (!p) return
    const v = pickupInput.safeParse(req.body)
    if (!v.success) {
      fail(res, 400, "VALIDATION_ERROR", "快递信息无效")
      return
    }
    const key = req.get("Idempotency-Key")
    if (key && key.length > 128) {
      fail(res, 400, "VALIDATION_ERROR", "幂等键过长")
      return
    }
    if (key) {
      const prior = await db.expressPickup.findUnique({
        where: {
          createdById_idempotencyKey: {
            createdById: p.user.id,
            idempotencyKey: key,
          },
        },
      })
      if (prior) {
        if (
          prior.address !== v.data.address ||
          prior.pickupCode !== v.data.pickupCode
        ) {
          fail(res, 409, "IDEMPOTENCY_CONFLICT", "幂等键对应不同快递")
          return
        }
        res.json(prior)
        return
      }
    }
    try {
      const row = await db.expressPickup.create({
        data: {
          ...v.data,
          source: "MANUAL",
          createdById: p.user.id,
          idempotencyKey: key,
        },
      })
      res.status(201).json(row)
    } catch (e) {
      if (key) {
        const prior = await db.expressPickup.findUnique({
          where: {
            createdById_idempotencyKey: {
              createdById: p.user.id,
              idempotencyKey: key,
            },
          },
        })
        if (prior) {
          res.json(prior)
          return
        }
      }
      throw e
    }
  })
)
const noticeInput = z
  .object({
    content: z.string().trim().min(1).max(4000).optional(),
    image: z.string().max(4_200_000).optional(),
  })
  .refine((v) => Number(!!v.content) + Number(!!v.image) === 1)
function validNoticeImage(data: string) {
  const match =
    /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(data)
  if (!match) return false
  const bytes = Buffer.from(match[2], "base64")
  if (!bytes.length || bytes.length > 3_000_000) return false
  const magic =
    match[1] === "jpeg"
      ? bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))
      : match[1] === "png"
        ? bytes
            .subarray(0, 8)
            .equals(
              Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
            )
        : bytes.subarray(0, 4).toString() === "RIFF" &&
          bytes.subarray(8, 12).toString() === "WEBP"
  return magic && bytes.toString("base64") === match[2]
}
app.post(
  `${base}/from-notice`,
  run(async (req, res) => {
    const p = await principal(req, res)
    if (!p) return
    const v = noticeInput.safeParse(req.body)
    if (!v.success || (v.data.image && !validNoticeImage(v.data.image))) {
      fail(
        res,
        400,
        "VALIDATION_ERROR",
        "请提交短信正文或一张 JPEG、PNG、WebP 截图"
      )
      return
    }
    const result = await parseNotice(v.data)
    const rawInfo = result.rawText?.slice(0, 4000) || null
    if (!result.ready || !result.address || !result.pickupCode) {
      res.json({
        status: "REVIEW",
        address: result.address || "",
        pickupCode: result.pickupCode || "",
        rawInfo,
        confidence: result.confidence,
        reason: result.reason,
      })
      return
    }
    const pickup = await db.expressPickup.create({
      data: {
        address: result.address,
        pickupCode: result.pickupCode,
        rawInfo,
        source: "MANUAL",
        createdById: p.user.id,
      },
    })
    res.status(201).json({ status: "CREATED", pickup })
  })
)
app.get(
  base,
  run(async (req, res) => {
    const p = await principal(req, res)
    if (!p) return
    const status = req.query.status === "DONE" ? "DONE" : "PENDING"
    const q = String(req.query.q || "").trim()
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100)
    let cursor: { createdAt: string; id: string } | undefined
    try {
      if (req.query.cursor)
        cursor = JSON.parse(
          Buffer.from(String(req.query.cursor), "base64url").toString()
        )
    } catch {
      fail(res, 400, "VALIDATION_ERROR", "游标无效")
      return
    }
    const conditions: Prisma.ExpressPickupWhereInput[] = [{ status }]
    if (q)
      conditions.push({
        OR: [
          { address: { contains: q, mode: "insensitive" } },
          { pickupCode: { contains: q, mode: "insensitive" } },
        ],
      })
    if (cursor)
      conditions.push({
        OR: [
          { createdAt: { lt: new Date(cursor.createdAt) } },
          { createdAt: new Date(cursor.createdAt), id: { lt: cursor.id } },
        ],
      })
    const items = await db.expressPickup.findMany({
      where: { AND: conditions },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
    })
    const hasMore = items.length > limit
    const list = items.slice(0, limit)
    const last = list.at(-1)
    res.json({
      items: list,
      nextCursor:
        hasMore && last
          ? Buffer.from(
              JSON.stringify({ createdAt: last.createdAt, id: last.id })
            ).toString("base64url")
          : null,
    })
  })
)
app.post(
  `${base}/done-by-code`,
  run(async (req, res) => {
    const p = await principal(req, res)
    if (!p) return
    const code = z
      .string()
      .trim()
      .min(1)
      .max(80)
      .safeParse(req.body?.pickupCode)
    if (!code.success) {
      fail(res, 400, "VALIDATION_ERROR", "取件码无效")
      return
    }
    const result = await db.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<
        Array<{ id: string }>
      >`SELECT id FROM "ExpressPickup" WHERE status='PENDING' AND "pickupCode"=${code.data} ORDER BY "updatedAt" DESC,id DESC FOR UPDATE`
      if (!rows.length) return null
      const row = await tx.expressPickup.update({
        where: { id: rows[0].id },
        data: { status: "DONE", doneAt: new Date(), doneById: p.user.id },
      })
      return { row, count: rows.length }
    })
    if (!result) {
      fail(res, 404, "NOT_FOUND", "没有待取快递")
      return
    }
    res.json({ ...result.row, matchedPendingCount: result.count })
  })
)
app.get(
  `${base}/:id`,
  run(async (req, res) => {
    const p = await principal(req, res)
    if (!p) return
    const row = await db.expressPickup.findUnique({
      where: { id: String(req.params.id) },
      include: {
        smsIngests: { select: { id: true, receivedAt: true, status: true } },
      },
    })
    if (!row) {
      fail(res, 404, "NOT_FOUND", "快递不存在")
      return
    }
    res.json(row)
  })
)
app.patch(
  `${base}/:id`,
  run(async (req, res) => {
    const p = await principal(req, res)
    if (!p) return
    const v = pickupPatch.safeParse(req.body)
    if (!v.success) {
      fail(res, 400, "VALIDATION_ERROR", "修改内容无效")
      return
    }
    const row = await db.expressPickup.findUnique({
      where: { id: String(req.params.id) },
    })
    if (!row) {
      fail(res, 404, "NOT_FOUND", "快递不存在")
      return
    }
    res.json(
      await db.expressPickup.update({ where: { id: row.id }, data: v.data })
    )
  })
)
app.post(
  `${base}/:id/done`,
  run(async (req, res) => {
    const p = await principal(req, res)
    if (!p) return
    const id = String(req.params.id)
    const row = await db.expressPickup.findUnique({ where: { id } })
    if (!row) {
      fail(res, 404, "NOT_FOUND", "快递不存在")
      return
    }
    if (row.status === "DONE") {
      res.json(row)
      return
    }
    await db.expressPickup.updateMany({
      where: { id, status: "PENDING" },
      data: { status: "DONE", doneAt: new Date(), doneById: p.user.id },
    })
    res.json(await db.expressPickup.findUnique({ where: { id } }))
  })
)
const constantToken = (given: string, expected: string) => {
  const a = Buffer.from(given),
    b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}
const normalizedSmsContent = (content: string) =>
  content.trim().replace(/\s+/g, " ")
const fingerprint = (v: z.infer<typeof smsInput>, receivedAt: Date) =>
  createHash("sha256")
    .update(
      [
        v.device.trim().toLowerCase(),
        (v.sender || "").trim().toLowerCase(),
        receivedAt.toISOString().slice(0, 19),
        normalizedSmsContent(v.content),
      ].join("|"),
      "utf8"
    )
    .digest("hex")
const matchesSmsIngest = (
  existing: { fingerprint: string; content: string; sender: string | null },
  data: z.infer<typeof smsInput>,
  hash: string
) =>
  existing.fingerprint === hash ||
  (!data.receivedAt &&
    normalizedSmsContent(existing.content) ===
      normalizedSmsContent(data.content) &&
    (existing.sender || "").trim().toLowerCase() ===
      (data.sender || "").trim().toLowerCase())
const smsLog = (level: "info" | "warn", message: string, fields: object) => {
  console[level](message, JSON.stringify(fields))
}
const smsValidationFields = (req: Request) => {
  const body = req.body
  const isObject =
    body !== null && typeof body === "object" && !Array.isArray(body)
  const fields = ["content", "device", "receivedAt", "sender", "clientEventId"]
  const receivedAt = isObject ? body.receivedAt : undefined
  return {
    code: "VALIDATION_ERROR",
    ip: req.ip,
    contentType: req.get("Content-Type") ?? null,
    bodyIsObject: isObject,
    fieldsPresent: Object.fromEntries(
      fields.map((field) => [field, isObject && Object.hasOwn(body, field)])
    ),
    contentLength:
      isObject && typeof body.content === "string" ? body.content.length : null,
    receivedAtType:
      receivedAt === null
        ? "null"
        : Array.isArray(receivedAt)
          ? "array"
          : typeof receivedAt,
    receivedAtValue:
      receivedAt === undefined ? null : String(receivedAt).slice(0, 64),
  }
}
const smsAccepted = (
  req: Request,
  data: z.infer<typeof smsInput>,
  id: string,
  status: 200 | 202,
  deduped: boolean
) => {
  smsLog("info", "SMS ingest accepted", {
    ip: req.ip,
    id,
    status,
    device: data.device.slice(0, 64),
    sender: data.sender?.slice(0, 64) ?? null,
    contentLength: data.content.length,
    deduped,
  })
}
app.post(
  "/api/sms/ingest",
  run(async (req, res) => {
    const requestReceivedAt = new Date()
    if (limited(`sms-ip:${req.ip}`, 60, 60000)) {
      smsLog("warn", "SMS ingest rate limited", { ip: req.ip, keyType: "ip" })
      fail(res, 429, "RATE_LIMITED", "请求过于频繁")
      return
    }
    const secret = process.env.SMS_INGEST_TOKEN || ""
    const given = req.headers.authorization?.replace(/^Bearer /i, "") || ""
    if (!secret || !constantToken(given, secret)) {
      smsLog("warn", "SMS ingest authentication failed", {
        ip: req.ip,
        reason: given ? "token mismatch" : "token missing",
      })
      fail(res, 401, "UNAUTHENTICATED", "无效凭据")
      return
    }
    const body =
      req.body !== null &&
      typeof req.body === "object" &&
      !Array.isArray(req.body)
        ? { ...req.body }
        : req.body
    if (
      body !== null &&
      typeof body === "object" &&
      !Array.isArray(body) &&
      !smsInput.shape.receivedAt.safeParse(body.receivedAt).success
    ) {
      delete body.receivedAt
    }
    const v = smsInput.safeParse(body)
    if (!v.success) {
      smsLog("warn", "SMS ingest validation failed", {
        ...smsValidationFields(req),
        issues: v.error.issues.map(({ path, message }) => ({ path, message })),
      })
      fail(res, 400, "VALIDATION_ERROR", "短信数据无效")
      return
    }
    const receivedAt = v.data.receivedAt
      ? new Date(v.data.receivedAt)
      : requestReceivedAt
    if (receivedAt.getTime() > requestReceivedAt.getTime() + 300000) {
      smsLog("warn", "SMS ingest validation failed", {
        ...smsValidationFields(req),
        issues: [
          { path: ["receivedAt"], message: "接收时间晚于当前时间 5 分钟" },
        ],
      })
      fail(res, 400, "VALIDATION_ERROR", "短信数据无效")
      return
    }
    if (limited(`sms-device:${v.data.device}`, 120, 60000)) {
      smsLog("warn", "SMS ingest rate limited", {
        ip: req.ip,
        keyType: "device",
      })
      fail(res, 429, "RATE_LIMITED", "设备请求过于频繁")
      return
    }
    const hash = fingerprint(v.data, receivedAt)
    if (v.data.clientEventId) {
      const existing = await db.smsIngest.findUnique({
        where: {
          device_clientEventId: {
            device: v.data.device,
            clientEventId: v.data.clientEventId,
          },
        },
      })
      if (existing) {
        if (!matchesSmsIngest(existing, v.data, hash)) {
          fail(res, 409, "IDEMPOTENCY_CONFLICT", "事件 ID 已用于另一条短信")
          return
        }
        smsAccepted(req, v.data, existing.id, 200, true)
        res.status(200).json({ id: existing.id, accepted: true, deduped: true })
        return
      }
    }
    try {
      const row = await db.smsIngest.create({
        data: {
          ...v.data,
          receivedAt,
          fingerprint: hash,
        },
      })
      smsAccepted(req, v.data, row.id, 202, false)
      res.status(202).json({ id: row.id, accepted: true, deduped: false })
    } catch {
      const existing =
        (await db.smsIngest.findUnique({ where: { fingerprint: hash } })) ||
        (v.data.clientEventId
          ? await db.smsIngest.findUnique({
              where: {
                device_clientEventId: {
                  device: v.data.device,
                  clientEventId: v.data.clientEventId,
                },
              },
            })
          : null)
      if (existing && matchesSmsIngest(existing, v.data, hash)) {
        smsAccepted(req, v.data, existing.id, 200, true)
        res.status(200).json({ id: existing.id, accepted: true, deduped: true })
        return
      }
      fail(res, 409, "IDEMPOTENCY_CONFLICT", "重复事件冲突")
    }
  })
)
app.get(
  "/api/sms/ingests",
  run(async (req, res) => {
    const p = await principal(req, res, true)
    if (!p) return
    const status = String(req.query.status || "")
    let cursor: { createdAt: string; id: string } | undefined
    try {
      if (req.query.cursor)
        cursor = JSON.parse(
          Buffer.from(String(req.query.cursor), "base64url").toString()
        )
    } catch {
      fail(res, 400, "VALIDATION_ERROR", "游标无效")
      return
    }
    const filters: Prisma.SmsIngestWhereInput[] = []
    const parsedStatus = Object.values(SmsIngestStatus).find(
      (value) => value === status
    )
    if (parsedStatus) filters.push({ status: parsedStatus })
    if (cursor)
      filters.push({
        OR: [
          { createdAt: { lt: new Date(cursor.createdAt) } },
          { createdAt: new Date(cursor.createdAt), id: { lt: cursor.id } },
        ],
      })
    const rows = await db.smsIngest.findMany({
      where: { AND: filters },
      select: {
        id: true,
        content: true,
        sender: true,
        device: true,
        receivedAt: true,
        status: true,
        errorCode: true,
        pickupId: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 51,
    })
    const items = rows.slice(0, 50)
    const last = items.at(-1)
    res.json({
      items,
      nextCursor:
        rows.length > 50 && last
          ? Buffer.from(
              JSON.stringify({ createdAt: last.createdAt, id: last.id })
            ).toString("base64url")
          : null,
    })
  })
)
app.get(
  "/api/sms/ingests/:id",
  run(async (req, res) => {
    const p = await principal(req, res, true)
    if (!p) return
    const row = await db.smsIngest.findUnique({
      where: { id: String(req.params.id) },
    })
    if (!row) {
      fail(res, 404, "NOT_FOUND", "短信不存在")
      return
    }
    res.json(row)
  })
)
app.post(
  "/api/sms/ingests/:id/retry",
  run(async (req, res) => {
    const p = await principal(req, res, true)
    if (!p) return
    const id = String(req.params.id)
    const changed = await db.smsIngest.updateMany({
      where: { id, status: "REVIEW", pickupId: null },
      data: { status: "RECEIVED", errorCode: null },
    })
    if (!changed.count) {
      fail(res, 409, "STATE_CONFLICT", "只有待审核记录可重试")
      return
    }
    res.json(await db.smsIngest.findUnique({ where: { id } }))
  })
)
app.post(
  "/api/sms/ingests/:id/link",
  run(async (req, res) => {
    const p = await principal(req, res, true)
    if (!p) return
    const id = String(req.params.id)
    const pickupId = z.string().min(1).safeParse(req.body?.pickupId)
    if (!pickupId.success) {
      fail(res, 400, "VALIDATION_ERROR", "快递 ID 无效")
      return
    }
    const pickup = await db.expressPickup.findUnique({
      where: { id: pickupId.data },
    })
    if (!pickup) {
      fail(res, 404, "NOT_FOUND", "快递不存在")
      return
    }
    const changed = await db.smsIngest.updateMany({
      where: { id, status: "REVIEW", pickupId: null },
      data: { status: "LINKED_EXISTING", pickupId: pickup.id, errorCode: null },
    })
    if (!changed.count) {
      fail(res, 409, "STATE_CONFLICT", "记录状态已变化")
      return
    }
    res.json(await db.smsIngest.findUnique({ where: { id } }))
  })
)
app.get(
  "/api/whitelist",
  run(async (req, res) => {
    const p = await principal(req, res, true)
    if (!p) return
    const items = await db.whitelist.findMany({ orderBy: { createdAt: "asc" } })
    res.json({ items })
  })
)
app.post(
  "/api/whitelist",
  run(async (req, res) => {
    const p = await principal(req, res, true)
    if (!p) return
    const v = whitelistInput.safeParse(req.body)
    if (!v.success) {
      fail(res, 400, "VALIDATION_ERROR", "白名单内容无效")
      return
    }
    const row = await db.whitelist.create({ data: v.data })
    res.status(201).json(row)
  })
)
app.post(
  "/api/whitelist/:id/set-password",
  run(async (req, res) => {
    const p = await principal(req, res, true)
    if (!p) return
    const parsed = z
      .object({ password: z.string().min(8).max(128) })
      .safeParse(req.body)
    if (!parsed.success) {
      fail(res, 400, "VALIDATION_ERROR", "密码至少 8 位")
      return
    }
    const id = String(req.params.id)
    await db.$transaction(async (tx) => {
      const white = await tx.whitelist.findUnique({ where: { id } })
      if (!white?.email || !white.enabled) throw new Error("MEMBER_NOT_FOUND")
      let userId = white.userId
      if (!userId) {
        const user = await tx.user.upsert({
          where: { email: white.email },
          create: {
            email: white.email,
            name: white.displayName,
            emailVerified: true,
          },
          update: {},
        })
        userId = user.id
        await tx.whitelist.update({ where: { id }, data: { userId } })
      }
      const password = await hashPassword(parsed.data.password)
      await tx.account.upsert({
        where: {
          providerId_accountId: { providerId: "credential", accountId: userId },
        },
        create: {
          providerId: "credential",
          accountId: userId,
          userId,
          password,
        },
        update: { password },
      })
    })
    res.json({ ok: true })
  })
)
app.patch(
  "/api/whitelist/:id",
  run(async (req, res) => {
    const p = await principal(req, res, true)
    if (!p) return
    const v = whitelistInput.partial().safeParse(req.body)
    if (!v.success) {
      fail(res, 400, "VALIDATION_ERROR", "白名单内容无效")
      return
    }
    const id = String(req.params.id)
    const row = await db.whitelist.findUnique({ where: { id } })
    if (!row) {
      fail(res, 404, "NOT_FOUND", "成员不存在")
      return
    }
    if (row.userId === p.user.id && v.data.enabled === false) {
      fail(res, 409, "STATE_CONFLICT", "不能停用自己")
      return
    }
    res.json(await db.whitelist.update({ where: { id }, data: v.data }))
  })
)

async function processSms(id: string) {
  const item = await db.smsIngest.findUnique({ where: { id } })
  if (!item || item.status !== "PROCESSING") return
  const out = await parseNotice({ content: item.content })
  if (out.reason === "AI_NOT_CONFIGURED" || out.reason === "AI_FAILED") {
    const result = await db.smsIngest.updateMany({
      where: { id, status: "PROCESSING" },
      data: {
        status: "REVIEW",
        errorCode: out.reason,
      },
    })
    if (result.count)
      smsLog("info", "SMS processed", {
        id,
        status: "REVIEW",
        reason: out.reason,
      })
    return
  }
  if (!out.isPickup) {
    const result = await db.smsIngest.updateMany({
      where: { id, status: "PROCESSING" },
      data: { status: "IGNORED" },
    })
    if (result.count) smsLog("info", "SMS processed", { id, status: "IGNORED" })
    return
  }
  const address = out.address?.trim(),
    pickupCode = out.pickupCode?.trim()
  if (!out.ready || !address || !pickupCode) {
    const result = await db.smsIngest.updateMany({
      where: { id, status: "PROCESSING" },
      data: { status: "REVIEW", errorCode: "LOW_CONFIDENCE" },
    })
    if (result.count)
      smsLog("info", "SMS processed", {
        id,
        status: "REVIEW",
        reason: "LOW_CONFIDENCE",
      })
    return
  }
  const status = await db.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<
      Array<{ id: string; status: string; pickupId: string | null }>
    >`SELECT id,status,"pickupId" FROM "SmsIngest" WHERE id=${id} FOR UPDATE`
    if (rows[0]?.status !== "PROCESSING" || rows[0].pickupId) return null
    const matches = await tx.expressPickup.findMany({
      where: {
        status: "PENDING",
        address: { equals: address, mode: "insensitive" },
        pickupCode: { equals: pickupCode, mode: "insensitive" },
      },
      take: 2,
    })
    if (matches.length > 1) {
      await tx.smsIngest.update({
        where: { id },
        data: { status: "REVIEW", errorCode: "AMBIGUOUS_MATCH" },
      })
      return "REVIEW"
    }
    if (matches.length === 1) {
      await tx.smsIngest.update({
        where: { id },
        data: {
          status: "LINKED_EXISTING",
          pickupId: matches[0].id,
          errorCode: null,
        },
      })
      return "LINKED_EXISTING"
    }
    const pickup = await tx.expressPickup.create({
      data: { address, pickupCode, rawInfo: item.content, source: "SMS" },
    })
    await tx.smsIngest.update({
      where: { id },
      data: { status: "CREATED", pickupId: pickup.id, errorCode: null },
    })
    return "CREATED"
  })
  if (status) smsLog("info", "SMS processed", { id, status })
}
async function worker() {
  try {
    const stale = new Date(Date.now() - 5 * 60_000)
    const rows = await db.$queryRaw<
      Array<{ id: string }>
    >`UPDATE "SmsIngest" SET status='PROCESSING',"updatedAt"=now() WHERE id IN (SELECT id FROM "SmsIngest" WHERE status='RECEIVED' OR (status='PROCESSING' AND "updatedAt"<${stale}) ORDER BY "createdAt" LIMIT 5 FOR UPDATE SKIP LOCKED) RETURNING id`
    for (const row of rows) await processSms(row.id)
  } catch {
    console.error("SMS worker cycle failed")
  }
}
app.get(
  "/api/health",
  run(async (_req, res) => {
    await db.$queryRaw`SELECT 1`
    res.json({ ok: true })
  })
)
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(
    "API request failed",
    err instanceof Error ? err.name : "unknown"
  )
  if (!res.headersSent) fail(res, 500, "INTERNAL_ERROR", "服务暂不可用")
})
const port = Number(process.env.PORT || 3001)
app.listen(port, process.env.HOST || "127.0.0.1", () => {
  console.log(`API listening on ${port}`)
  setInterval(worker, 5000).unref()
  void worker()
})
