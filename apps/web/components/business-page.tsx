"use client"
import { useCallback, useEffect, useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Field, FieldGroup, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { Textarea } from "@workspace/ui/components/textarea"
import { Plus, Check } from "lucide-react"
import { useAppRole } from "@/components/app-shell"
async function api<T>(
  path: string,
  method = "GET",
  body?: unknown
): Promise<T> {
  const r = await fetch(`/family/api${path}`, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  })
  const j = await r.json()
  if (!r.ok) throw new Error(j.error?.message || "请求失败")
  return j
}
async function miniAppId() {
  return (await api<{ wechatMiniAppId: string }>("/public-config"))
    .wechatMiniAppId
}
type Pickup = {
  id: string
  address: string
  pickupCode: string
  recipientName?: string | null
  rawInfo?: string | null
  source: string
  status: string
  createdAt: string
}
type NoticeResponse =
  | { status: "CREATED"; pickup: Pickup }
  | {
      status: "REVIEW"
      address: string
      pickupCode: string
      rawInfo: string | null
      reason?: string
    }
type Sms = {
  id: string
  sender?: string
  device: string
  status: string
  receivedAt: string
  content: string
  errorCode?: string
  pickupId?: string
}
type Member = {
  id: string
  displayName: string
  email?: string
  wechatOpenId?: string
  wechatUnionId?: string
  role: string
  enabled: boolean
}
export function BusinessPage({
  page,
}: {
  page: "pickups" | "sms" | "members"
}) {
  const role = useAppRole()
  const [error, setError] = useState("")
  const [status, setStatus] = useState("PENDING")
  const [q, setQ] = useState("")
  const [pickups, setPickups] = useState<Pickup[]>([])
  const [sms, setSms] = useState<Sms[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [selected, setSelected] = useState<Pickup | null>(null)
  const [smsSelected, setSmsSelected] = useState<Sms | null>(null)
  const [editing, setEditing] = useState(false)
  const [noticeFile, setNoticeFile] = useState<File | null>(null)
  const [noticeReview, setNoticeReview] = useState(false)
  const [noticeReason, setNoticeReason] = useState("")
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    address: "",
    pickupCode: "",
    recipientName: "",
    rawInfo: "",
  })
  const [member, setMember] = useState({
    displayName: "",
    email: "",
    wechatOpenId: "",
    wechatUnionId: "",
  })
  const [code, setCode] = useState("")
  const refresh = useCallback(async () => {
    try {
      if (page === "pickups")
        setPickups(
          (
            await api<{ items: Pickup[] }>(
              `/express/pickups?status=${status}&q=${encodeURIComponent(q)}`
            )
          ).items
        )
      if (role === "ADMIN" && page === "sms")
        setSms((await api<{ items: Sms[] }>("/sms/ingests")).items)
      if (role === "ADMIN" && page === "members")
        setMembers((await api<{ items: Member[] }>("/whitelist")).items)
    } catch (e) {
      setError((e as Error).message)
    }
  }, [status, q, role, page])
  useEffect(() => {
    const timer = setTimeout(() => void refresh(), 0)
    return () => clearTimeout(timer)
  }, [refresh])
  const action = async (fn: () => Promise<unknown>) => {
    try {
      setError("")
      await fn()
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    }
  }
  return (
    <div>
      <header className="mb-8 flex items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">
          {page === "pickups"
            ? "家里的快递"
            : page === "sms"
              ? "短信接入记录"
              : "家庭成员"}
        </h1>
        <Badge variant="secondary">
          {role === "ADMIN" ? "管理员" : "家庭成员"}
        </Badge>
      </header>
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {page === "pickups" && (
        <>
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <div className="flex gap-1 rounded-lg bg-muted p-1">
              <Button
                variant={status === "PENDING" ? "secondary" : "ghost"}
                onClick={() => setStatus("PENDING")}
              >
                待取
              </Button>
              <Button
                variant={status === "DONE" ? "secondary" : "ghost"}
                onClick={() => setStatus("DONE")}
              >
                已取
              </Button>
            </div>
            <Input
              className="min-w-48 flex-1 md:max-w-xs"
              placeholder="搜索地点或取件码"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <Button
              variant="default"
              onClick={() => {
                setSelected(null)
                setForm({
                  address: "",
                  pickupCode: "",
                  recipientName: "",
                  rawInfo: "",
                })
                setNoticeFile(null)
                setNoticeReview(false)
                setNoticeReason("")
                setEditing(true)
              }}
            >
              <Plus data-icon="inline-start" />
              录入快递
            </Button>
          </div>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(300px,2fr)]">
            <div className="flex min-w-0 flex-col gap-3">
              {pickups.length ? (
                pickups.map((p) => (
                  <Card
                    className="cursor-pointer"
                    key={p.id}
                    onClick={() => setSelected(p)}
                    onKeyDown={(event) => {
                      if (
                        event.target === event.currentTarget &&
                        (event.key === "Enter" || event.key === " ")
                      ) {
                        event.preventDefault()
                        setSelected(p)
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <CardHeader>
                      <div className="flex items-center justify-between gap-3">
                        <Badge variant="secondary">
                          {p.source === "SMS" ? "短信自动" : "手工录入"}
                        </Badge>
                        <small>
                          {new Date(p.createdAt).toLocaleString("zh-CN")}
                        </small>
                      </div>
                      <CardTitle>{p.address}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between gap-3">
                        <strong>{p.pickupCode}</strong>
                        {p.status === "PENDING" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              void action(() =>
                                api(`/express/pickups/${p.id}/done`, "POST")
                              )
                            }}
                          >
                            <Check data-icon="inline-start" />
                            标记已取
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                  这里还没有快递
                </div>
              )}
            </div>
            <Card className="h-fit">
              <CardContent className="flex flex-col gap-4">
                {selected ? (
                  <>
                    <small>快递详情</small>
                    <h2>{selected.address}</h2>
                    <div className="my-5 rounded-lg bg-muted p-4 text-2xl font-semibold tracking-widest">
                      {selected.pickupCode}
                    </div>
                    <dl className="grid grid-cols-[7rem_1fr] gap-3 text-sm [&_dd]:break-all [&_dt]:text-muted-foreground">
                      <dt>状态</dt>
                      <dd>{selected.status === "PENDING" ? "待取" : "已取"}</dd>
                      <dt>来源</dt>
                      <dd>
                        {selected.source === "SMS" ? "短信自动" : "手工录入"}
                      </dd>
                      <dt>收件人</dt>
                      <dd>{selected.recipientName || "—"}</dd>
                      <dt>录入时间</dt>
                      <dd>
                        {new Date(selected.createdAt).toLocaleString("zh-CN")}
                      </dd>
                      <dt>通知原文</dt>
                      <dd>{selected.rawInfo || "—"}</dd>
                    </dl>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setForm({
                          address: selected.address,
                          pickupCode: selected.pickupCode,
                          recipientName: selected.recipientName || "",
                          rawInfo: selected.rawInfo || "",
                        })
                        setNoticeFile(null)
                        setNoticeReview(false)
                        setEditing(true)
                      }}
                    >
                      编辑信息
                    </Button>
                  </>
                ) : (
                  <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                    选择一条快递查看详情
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          {role === "ADMIN" && (
            <Card className="mt-6">
              <CardContent className="flex flex-wrap items-center gap-3">
                <strong>按取件码完成</strong>
                <Input
                  className="w-full sm:ml-auto sm:max-w-xs"
                  placeholder="输入取件码"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
                <Button
                  onClick={() =>
                    void action(async () => {
                      const found = (
                        await api<{
                          items: (Pickup & { updatedAt: string })[]
                        }>(
                          `/express/pickups?status=PENDING&q=${encodeURIComponent(code)}&limit=100`
                        )
                      ).items
                        .filter((p) => p.pickupCode === code)
                        .sort(
                          (a, b) =>
                            b.updatedAt.localeCompare(a.updatedAt) ||
                            b.id.localeCompare(a.id)
                        )
                      if (!found.length) throw new Error("没有匹配的待取快递")
                      if (
                        !window.confirm(
                          `将完成：${found[0]!.address} · ${found[0]!.pickupCode}${found.length > 1 ? `（同码共 ${found.length} 条，选最近更新）` : ""}，确认吗？`
                        )
                      )
                        return
                      const result = await api<
                        Pickup & { matchedPendingCount: number }
                      >("/express/pickups/done-by-code", "POST", {
                        pickupCode: code,
                      })
                      setSelected(result)
                      setCode("")
                    })
                  }
                >
                  完成
                </Button>
              </CardContent>
            </Card>
          )}
        </>
      )}
      {page === "sms" && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(300px,2fr)]">
          <div className="flex min-w-0 flex-col gap-3">
            {sms.map((s) => (
              <Button
                variant="outline"
                className="h-auto flex-col items-start gap-1 p-4 text-left"
                key={s.id}
                onClick={() =>
                  void action(async () =>
                    setSmsSelected(await api<Sms>(`/sms/ingests/${s.id}`))
                  )
                }
              >
                <small>{new Date(s.receivedAt).toLocaleString("zh-CN")}</small>
                <span className="line-clamp-2 w-full break-all whitespace-normal">
                  {s.content}
                </span>
              </Button>
            ))}
            {!sms.length && (
              <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                还没有短信记录
              </div>
            )}
          </div>
          <Card className="h-fit">
            <CardContent className="flex flex-col gap-4">
              {smsSelected ? (
                <>
                  <h2>短信详情</h2>
                  <p>{smsSelected.content}</p>
                  <p>
                    状态：{smsSelected.status} {smsSelected.errorCode || ""}
                  </p>
                  {smsSelected.status === "REVIEW" && (
                    <>
                      <Button
                        onClick={() =>
                          void action(() =>
                            api(`/sms/ingests/${smsSelected.id}/retry`, "POST")
                          )
                        }
                      >
                        重新处理
                      </Button>
                      <Input id="link-id" placeholder="已有快递 ID" />
                      <Button
                        onClick={() =>
                          void action(() =>
                            api(`/sms/ingests/${smsSelected.id}/link`, "POST", {
                              pickupId: (
                                document.getElementById(
                                  "link-id"
                                ) as HTMLInputElement
                              ).value,
                            })
                          )
                        }
                      >
                        确认关联
                      </Button>
                    </>
                  )}
                </>
              ) : (
                <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                  选择一条短信查看
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
      {page === "members" && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>白名单</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {members.map((m) => (
                <div
                  className="flex flex-wrap items-center gap-3 border-b px-5 py-4 last:border-b-0"
                  key={m.id}
                >
                  <div>
                    <b>{m.displayName}</b>
                    <p>{m.email || m.wechatOpenId || m.wechatUnionId}</p>
                  </div>
                  <span>{m.role === "ADMIN" ? "管理员" : "成员"}</span>
                  {m.email && (
                    <Button
                      onClick={() => {
                        const password = window.prompt(
                          `为 ${m.displayName} 设置初始密码（至少 8 位）`
                        )
                        if (password)
                          void action(() =>
                            api(`/whitelist/${m.id}/set-password`, "POST", {
                              password,
                            })
                          )
                      }}
                    >
                      设密码
                    </Button>
                  )}
                  <Button
                    onClick={() => {
                      const openid = window.prompt(
                        `绑定 ${m.displayName} 的微信 openid`,
                        m.wechatOpenId || ""
                      )
                      if (openid)
                        void action(async () =>
                          api(`/whitelist/${m.id}`, "PATCH", {
                            wechatAppId: await miniAppId(),
                            wechatOpenId: openid,
                          })
                        )
                    }}
                  >
                    绑定微信
                  </Button>
                  <Button
                    onClick={() =>
                      void action(() =>
                        api(`/whitelist/${m.id}`, "PATCH", {
                          enabled: !m.enabled,
                        })
                      )
                    }
                  >
                    {m.enabled ? "停用" : "启用"}
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card className="mt-6 max-w-xl">
            <CardHeader>
              <CardTitle>添加家庭成员</CardTitle>
              <CardDescription>
                填邮箱、openid 或 unionid 中的至少一项。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                className="flex flex-col gap-4"
                onSubmit={(e) => {
                  e.preventDefault()
                  void action(async () => {
                    await api("/whitelist", "POST", {
                      displayName: member.displayName,
                      email: member.email || undefined,
                      wechatAppId: member.wechatOpenId
                        ? await miniAppId()
                        : undefined,
                      wechatOpenId: member.wechatOpenId || undefined,
                      wechatUnionId: member.wechatUnionId || undefined,
                    })
                    setMember({
                      displayName: "",
                      email: "",
                      wechatOpenId: "",
                      wechatUnionId: "",
                    })
                  })
                }}
              >
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="member-name">称呼</FieldLabel>
                    <Input
                      id="member-name"
                      required
                      placeholder="称呼"
                      value={member.displayName}
                      onChange={(e) =>
                        setMember({ ...member, displayName: e.target.value })
                      }
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="member-email">邮箱</FieldLabel>
                    <Input
                      id="member-email"
                      placeholder="邮箱"
                      value={member.email}
                      onChange={(e) =>
                        setMember({ ...member, email: e.target.value })
                      }
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="member-openid">微信 openid</FieldLabel>
                    <Input
                      id="member-openid"
                      placeholder="微信 openid"
                      value={member.wechatOpenId}
                      onChange={(e) =>
                        setMember({ ...member, wechatOpenId: e.target.value })
                      }
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="member-unionid">
                      微信 unionid
                    </FieldLabel>
                    <Input
                      id="member-unionid"
                      placeholder="微信 unionid"
                      value={member.wechatUnionId}
                      onChange={(e) =>
                        setMember({
                          ...member,
                          wechatUnionId: e.target.value,
                        })
                      }
                    />
                  </Field>
                </FieldGroup>
                <Button variant="default">添加</Button>
              </form>
            </CardContent>
          </Card>
        </>
      )}
      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setEditing(false)}
        >
          <Card
            className="w-full max-w-lg"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pickup-form-title"
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader>
              <CardTitle id="pickup-form-title">
                {selected ? "编辑快递" : "录入快递"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form
                className="flex flex-col gap-4"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (saving) return
                  setSaving(true)
                  void action(async () => {
                    try {
                      if (
                        !selected &&
                        !noticeReview &&
                        (noticeFile || form.rawInfo.trim())
                      ) {
                        const image = noticeFile
                          ? await new Promise<string>((resolve, reject) => {
                              const reader = new FileReader()
                              reader.onload = () =>
                                resolve(String(reader.result))
                              reader.onerror = () =>
                                reject(new Error("截图读取失败"))
                              reader.readAsDataURL(noticeFile)
                            })
                          : undefined
                        const result = await api<NoticeResponse>(
                          "/express/pickups/from-notice",
                          "POST",
                          image ? { image } : { content: form.rawInfo }
                        )
                        if (result.status === "REVIEW") {
                          setForm({
                            ...form,
                            address: result.address,
                            pickupCode: result.pickupCode,
                            rawInfo: result.rawInfo || form.rawInfo,
                          })
                          setNoticeReview(true)
                          setNoticeReason(result.reason || "INCOMPLETE")
                          return
                        }
                      } else {
                        await api(
                          selected
                            ? `/express/pickups/${selected.id}`
                            : "/express/pickups",
                          selected ? "PATCH" : "POST",
                          form
                        )
                      }
                      setEditing(false)
                      setSelected(null)
                      setNoticeFile(null)
                      setNoticeReview(false)
                    } finally {
                      setSaving(false)
                    }
                  })
                }}
              >
                {noticeReview && (
                  <Alert>
                    <AlertDescription>
                      {noticeReason === "AI_NOT_CONFIGURED"
                        ? "图片识别尚未配置，请手填地点和取件码后确认保存。"
                        : noticeReason === "AI_FAILED"
                          ? "识别暂时失败，请核对并补齐信息后确认保存。"
                          : "识别结果不完整或不确定，请核对并补齐信息后确认保存。"}
                    </AlertDescription>
                  </Alert>
                )}
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="pickup-address">取件地点</FieldLabel>
                    <Input
                      id="pickup-address"
                      required={
                        !!selected ||
                        noticeReview ||
                        (!form.rawInfo.trim() && !noticeFile)
                      }
                      maxLength={200}
                      value={form.address}
                      onChange={(e) =>
                        setForm({ ...form, address: e.target.value })
                      }
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="pickup-code">取件码</FieldLabel>
                    <Input
                      id="pickup-code"
                      required={
                        !!selected ||
                        noticeReview ||
                        (!form.rawInfo.trim() && !noticeFile)
                      }
                      maxLength={80}
                      value={form.pickupCode}
                      onChange={(e) =>
                        setForm({ ...form, pickupCode: e.target.value })
                      }
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="pickup-recipient">收件人</FieldLabel>
                    <Input
                      id="pickup-recipient"
                      maxLength={80}
                      value={form.recipientName}
                      onChange={(e) =>
                        setForm({ ...form, recipientName: e.target.value })
                      }
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="pickup-info">短信正文</FieldLabel>
                    <Textarea
                      id="pickup-info"
                      maxLength={4000}
                      value={form.rawInfo}
                      placeholder="粘贴通知短信，可只填这一项"
                      onChange={(e) => {
                        setForm({ ...form, rawInfo: e.target.value })
                        if (e.target.value) setNoticeFile(null)
                      }}
                    />
                  </Field>
                  {!selected && (
                    <Field>
                      <FieldLabel htmlFor="pickup-image">通知截图</FieldLabel>
                      <Input
                        id="pickup-image"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null
                          if (
                            file &&
                            (![
                              "image/jpeg",
                              "image/png",
                              "image/webp",
                            ].includes(file.type) ||
                              file.size > 3_000_000)
                          ) {
                            setError(
                              "请上传小于 3 MB 的 JPEG、PNG 或 WebP 图片"
                            )
                            e.target.value = ""
                            return
                          }
                          setError("")
                          setNoticeFile(file)
                          if (file) setForm({ ...form, rawInfo: "" })
                        }}
                      />
                      <small className="text-muted-foreground">
                        只传一张截图也可以录入
                      </small>
                    </Field>
                  )}
                </FieldGroup>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditing(false)}
                  >
                    取消
                  </Button>
                  <Button type="submit" variant="default" disabled={saving}>
                    {saving
                      ? "处理中…"
                      : noticeReview
                        ? "确认并保存"
                        : !selected && (noticeFile || form.rawInfo.trim())
                          ? "识别并录入"
                          : "保存"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
