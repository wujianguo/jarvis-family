"use client"
import { useCallback, useEffect, useState } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useSession, useSignInEmail } from "@better-auth-ui/react"
import { createAuthClient } from "better-auth/react"
import {
  Package,
  MessageSquare,
  Users,
  LogOut,
  Plus,
  Check,
} from "lucide-react"
import "./wo.css"
const client = createAuthClient({
  baseURL:
    typeof window === "undefined"
      ? "http://localhost:3001/api/auth"
      : `${location.origin}/family/api/auth`,
})
const query = new QueryClient()
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
type Sms = {
  id: string
  sender?: string
  device: string
  status: string
  receivedAt: string
  content?: string
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
function Home() {
  const session = useSession(client)
  const signin = useSignInEmail(client)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [role, setRole] = useState("")
  const [tab, setTab] = useState("pickups")
  const [status, setStatus] = useState("PENDING")
  const [q, setQ] = useState("")
  const [pickups, setPickups] = useState<Pickup[]>([])
  const [sms, setSms] = useState<Sms[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [selected, setSelected] = useState<Pickup | null>(null)
  const [smsSelected, setSmsSelected] = useState<Sms | null>(null)
  const [editing, setEditing] = useState(false)
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
      const me = await api<{ role: string }>("/me")
      setRole(me.role)
      setPickups(
        (
          await api<{ items: Pickup[] }>(
            `/express/pickups?status=${status}&q=${encodeURIComponent(q)}`
          )
        ).items
      )
      if (me.role === "ADMIN") {
        setSms((await api<{ items: Sms[] }>("/sms/ingests")).items)
        setMembers((await api<{ items: Member[] }>("/whitelist")).items)
      }
    } catch (e) {
      setError((e as Error).message)
    }
  }, [status, q, role])
  useEffect(() => {
    if (!session.data?.user) return
    const timer = setTimeout(() => void refresh(), 0)
    return () => clearTimeout(timer)
  }, [session.data?.user, refresh])
  const action = async (fn: () => Promise<unknown>) => {
    try {
      setError("")
      await fn()
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    }
  }
  if (session.isPending)
    return <main className="center">正在检查登录状态…</main>
  if (!session.data?.user)
    return (
      <main className="login">
        <form
          className="login-card"
          onSubmit={(e) => {
            e.preventDefault()
            setError("")
            signin.mutate(
              { email, password },
              {
                onSuccess: () => void session.refetch(),
                onError: (e) => setError(e.message),
              }
            )
          }}
        >
          <div className="mark">窝</div>
          <h1>欢迎回到窝事</h1>
          <p>家里的快递，一眼就知道。</p>
          <label>
            邮箱
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            密码
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button className="primary" disabled={signin.isPending}>
            登录
          </button>
          {error && <p className="error">{error}</p>}
          <small>仅受邀家庭成员可登录</small>
        </form>
      </main>
    )
  return (
    <div className="shell">
      <aside>
        <div className="brand">
          <span className="mark">窝</span>
          <div>
            <b>窝事</b>
            <small>家庭快递管家</small>
          </div>
        </div>
        <nav>
          <button
            className={tab === "pickups" ? "active" : ""}
            onClick={() => setTab("pickups")}
          >
            <Package size={18} />
            快递
          </button>
          {role === "ADMIN" && (
            <>
              <button
                className={tab === "sms" ? "active" : ""}
                onClick={() => setTab("sms")}
              >
                <MessageSquare size={18} />
                SMS 接入
              </button>
              <button
                className={tab === "members" ? "active" : ""}
                onClick={() => setTab("members")}
              >
                <Users size={18} />
                家庭成员
              </button>
            </>
          )}
        </nav>
        <div className="aside-foot">
          <small>{session.data.user.email}</small>
          <button
            onClick={() => void client.signOut().then(() => session.refetch())}
          >
            <LogOut size={16} />
            退出登录
          </button>
        </div>
      </aside>
      <main className="content">
        <header>
          <div>
            <small>
              窝事 /{" "}
              {tab === "pickups"
                ? "快递"
                : tab === "sms"
                  ? "SMS 接入"
                  : "家庭成员"}
            </small>
            <h1>
              {tab === "pickups"
                ? "家里的快递"
                : tab === "sms"
                  ? "短信接入记录"
                  : "家庭成员"}
            </h1>
          </div>
          <span>{role === "ADMIN" ? "管理员" : "家庭成员"}</span>
        </header>
        {error && <div className="error">{error}</div>}
        {tab === "pickups" && (
          <>
            <div className="toolbar">
              <div className="segment">
                <button
                  className={status === "PENDING" ? "chosen" : ""}
                  onClick={() => setStatus("PENDING")}
                >
                  待取
                </button>
                <button
                  className={status === "DONE" ? "chosen" : ""}
                  onClick={() => setStatus("DONE")}
                >
                  已取
                </button>
              </div>
              <input
                placeholder="搜索地点或取件码"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <button
                className="primary"
                onClick={() => {
                  setSelected(null)
                  setForm({
                    address: "",
                    pickupCode: "",
                    recipientName: "",
                    rawInfo: "",
                  })
                  setEditing(true)
                }}
              >
                <Plus size={16} />
                录入快递
              </button>
            </div>
            <div className="columns">
              <div className="list">
                {pickups.length ? (
                  pickups.map((p) => (
                    <div
                      className="card"
                      key={p.id}
                      onClick={() => setSelected(p)}
                    >
                      <div className="meta">
                        <span className="badge">
                          {p.source === "SMS" ? "短信自动" : "手工录入"}
                        </span>
                        <small>
                          {new Date(p.createdAt).toLocaleString("zh-CN")}
                        </small>
                      </div>
                      <h2>{p.address}</h2>
                      <div className="card-foot">
                        <strong>{p.pickupCode}</strong>
                        {p.status === "PENDING" && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              void action(() =>
                                api(`/express/pickups/${p.id}/done`, "POST")
                              )
                            }}
                          >
                            <Check size={14} />
                            标记已取
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="empty">这里还没有快递</div>
                )}
              </div>
              <div className="detail">
                {selected ? (
                  <>
                    <small>快递详情</small>
                    <h2>{selected.address}</h2>
                    <div className="big-code">{selected.pickupCode}</div>
                    <dl>
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
                    <button
                      onClick={() => {
                        setForm({
                          address: selected.address,
                          pickupCode: selected.pickupCode,
                          recipientName: selected.recipientName || "",
                          rawInfo: selected.rawInfo || "",
                        })
                        setEditing(true)
                      }}
                    >
                      编辑信息
                    </button>
                  </>
                ) : (
                  <div className="empty">选择一条快递查看详情</div>
                )}
              </div>
            </div>
            {role === "ADMIN" && (
              <div className="by-code">
                <strong>按取件码完成</strong>
                <input
                  placeholder="输入取件码"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
                <button
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
                </button>
              </div>
            )}
          </>
        )}
        {tab === "sms" && (
          <div className="columns">
            <div className="list">
              {sms.map((s) => (
                <button
                  className="sms-card"
                  key={s.id}
                  onClick={() =>
                    void action(async () =>
                      setSmsSelected(await api<Sms>(`/sms/ingests/${s.id}`))
                    )
                  }
                >
                  <b>{s.status}</b>
                  <span>
                    {s.sender || "未知发件人"} · {s.device}
                  </span>
                  <small>
                    {new Date(s.receivedAt).toLocaleString("zh-CN")}
                  </small>
                </button>
              ))}
              {!sms.length && <div className="empty">还没有短信记录</div>}
            </div>
            <div className="detail">
              {smsSelected ? (
                <>
                  <h2>短信详情</h2>
                  <p>{smsSelected.content}</p>
                  <p>
                    状态：{smsSelected.status} {smsSelected.errorCode || ""}
                  </p>
                  {smsSelected.status === "REVIEW" && (
                    <>
                      <button
                        onClick={() =>
                          void action(() =>
                            api(`/sms/ingests/${smsSelected.id}/retry`, "POST")
                          )
                        }
                      >
                        重新处理
                      </button>
                      <input id="link-id" placeholder="已有快递 ID" />
                      <button
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
                      </button>
                    </>
                  )}
                </>
              ) : (
                <div className="empty">选择一条短信查看</div>
              )}
            </div>
          </div>
        )}
        {tab === "members" && (
          <>
            <div className="members">
              {members.map((m) => (
                <div className="member" key={m.id}>
                  <div>
                    <b>{m.displayName}</b>
                    <p>{m.email || m.wechatOpenId || m.wechatUnionId}</p>
                  </div>
                  <span>{m.role === "ADMIN" ? "管理员" : "成员"}</span>
                  {m.email && (
                    <button
                      onClick={() => {
                        const password = window.prompt(
                          `为 ${m.displayName} 设置初始密码（至少 16 位）`
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
                    </button>
                  )}
                  <button
                    onClick={() => {
                      const openid = window.prompt(
                        `绑定 ${m.displayName} 的微信 openid`,
                        m.wechatOpenId || ""
                      )
                      if (openid)
                        void action(() =>
                          api(`/whitelist/${m.id}`, "PATCH", {
                            wechatAppId: "wxce94463a6a805e99",
                            wechatOpenId: openid,
                          })
                        )
                    }}
                  >
                    绑定微信
                  </button>
                  <button
                    onClick={() =>
                      void action(() =>
                        api(`/whitelist/${m.id}`, "PATCH", {
                          enabled: !m.enabled,
                        })
                      )
                    }
                  >
                    {m.enabled ? "停用" : "启用"}
                  </button>
                </div>
              ))}
            </div>
            <form
              className="member-form"
              onSubmit={(e) => {
                e.preventDefault()
                void action(async () => {
                  await api("/whitelist", "POST", {
                    displayName: member.displayName,
                    email: member.email || undefined,
                    wechatAppId: member.wechatOpenId
                      ? "wxce94463a6a805e99"
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
              <h2>添加家庭成员</h2>
              <p>填邮箱、openid 或 unionid 中的至少一项。</p>
              <input
                required
                placeholder="称呼"
                value={member.displayName}
                onChange={(e) =>
                  setMember({ ...member, displayName: e.target.value })
                }
              />
              <input
                placeholder="邮箱"
                value={member.email}
                onChange={(e) =>
                  setMember({ ...member, email: e.target.value })
                }
              />
              <input
                placeholder="微信 openid"
                value={member.wechatOpenId}
                onChange={(e) =>
                  setMember({ ...member, wechatOpenId: e.target.value })
                }
              />
              <input
                placeholder="微信 unionid"
                value={member.wechatUnionId}
                onChange={(e) =>
                  setMember({ ...member, wechatUnionId: e.target.value })
                }
              />
              <button className="primary">添加</button>
            </form>
          </>
        )}
      </main>
      {editing && (
        <div className="overlay" onClick={() => setEditing(false)}>
          <form
            className="modal"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault()
              void action(async () => {
                await api(
                  selected
                    ? `/express/pickups/${selected.id}`
                    : "/express/pickups",
                  selected ? "PATCH" : "POST",
                  form
                )
                setEditing(false)
                setSelected(null)
              })
            }}
          >
            <h2>{selected ? "编辑快递" : "录入快递"}</h2>
            <label>
              取件地点
              <input
                required
                maxLength={200}
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </label>
            <label>
              取件码
              <input
                required
                maxLength={80}
                value={form.pickupCode}
                onChange={(e) =>
                  setForm({ ...form, pickupCode: e.target.value })
                }
              />
            </label>
            <label>
              收件人
              <input
                maxLength={80}
                value={form.recipientName}
                onChange={(e) =>
                  setForm({ ...form, recipientName: e.target.value })
                }
              />
            </label>
            <label>
              短信原文
              <textarea
                maxLength={4000}
                value={form.rawInfo}
                onChange={(e) => setForm({ ...form, rawInfo: e.target.value })}
              />
            </label>
            <div className="actions">
              <button type="button" onClick={() => setEditing(false)}>
                取消
              </button>
              <button className="primary">保存</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
export default function Page() {
  return (
    <QueryClientProvider client={query}>
      <Home />
    </QueryClientProvider>
  )
}
