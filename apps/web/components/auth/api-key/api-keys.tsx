"use client"

import { useCallback, useEffect, useState } from "react"
import { authClient } from "@/lib/auth/client"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"

type Key = {
  id: string
  name?: string | null
  start?: string | null
  createdAt: Date
}

export function ApiKeys() {
  const [keys, setKeys] = useState<Key[]>([])
  const [name, setName] = useState("")
  const [createdKey, setCreatedKey] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const result = await authClient.apiKey.list()
    if (result.error) throw new Error(result.error.message)
    setKeys(result.data ?? [])
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      void load().catch((cause: Error) => setError(cause.message))
    }, 0)
    return () => clearTimeout(timer)
  }, [load])

  async function create() {
    setBusy(true)
    setError("")
    try {
      const result = await authClient.apiKey.create({ name: name.trim() })
      if (result.error) throw new Error(result.error.message)
      setCreatedKey(result.data?.key ?? "")
      setName("")
      await load()
    } catch (cause) {
      setError((cause as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function revoke(keyId: string) {
    if (!window.confirm("确定撤销这个 API Key？撤销后将无法恢复。")) return
    setBusy(true)
    setError("")
    try {
      const result = await authClient.apiKey.delete({ keyId })
      if (result.error) throw new Error(result.error.message)
      await load()
    } catch (cause) {
      setError((cause as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>API Key</CardTitle>
        <CardDescription>
          创建和管理你自己的密钥。新密钥只显示一次。
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          <Input
            aria-label="API Key 名称"
            placeholder="密钥名称"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="max-w-xs"
          />
          <Button disabled={busy || !name.trim()} onClick={() => void create()}>
            创建 API Key
          </Button>
        </div>
        {createdKey && (
          <div className="rounded-md border p-3">
            <p className="mb-2 text-sm">
              请现在复制并妥善保存，此后无法再次查看。
            </p>
            <code className="block break-all select-all">{createdKey}</code>
            <Button
              variant="outline"
              className="mt-2"
              onClick={() => void navigator.clipboard.writeText(createdKey)}
            >
              复制密钥
            </Button>
          </div>
        )}
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
        {keys.length === 0 && (
          <p className="text-sm text-muted-foreground">暂无 API Key</p>
        )}
        {keys.map((key) => (
          <div
            key={key.id}
            className="flex items-center justify-between gap-4 border-t pt-3"
          >
            <div className="min-w-0">
              <p className="font-medium">{key.name || "未命名密钥"}</p>
              <p className="text-sm text-muted-foreground">
                {key.start ? `${key.start}… · ` : ""}
                {new Date(key.createdAt).toLocaleString("zh-CN")}
              </p>
            </div>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => void revoke(key.id)}
            >
              撤销
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
