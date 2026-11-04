"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { useSession } from "@better-auth-ui/react"
import { usePathname, useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { Moon, Sun } from "lucide-react"
import { AppSidebar, appPath } from "@/components/app-sidebar"
import { Auth } from "@/components/auth/auth"
import { authClient } from "@/lib/auth/client"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@workspace/ui/components/breadcrumb"
import { Separator } from "@workspace/ui/components/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@workspace/ui/components/sidebar"

const RoleContext = createContext("")
export const useAppRole = () => useContext(RoleContext)

const titles: Record<string, string> = {
  "/": "快递",
  "/sms": "SMS 接入",
  "/members": "家庭成员",
  "/settings": "设置",
}

function SignInScreen() {
  const { resolvedTheme, setTheme } = useTheme()
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 p-6">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="absolute top-6 right-6"
        aria-label="切换主题"
        onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      >
        {resolvedTheme === "dark" ? <Sun /> : <Moon />}
      </Button>
      <div className="flex w-full max-w-sm flex-col items-center gap-4">
        <h1 className="text-2xl font-semibold">窝事</h1>
        <p className="text-sm text-muted-foreground">
          家里的快递，一眼就知道。
        </p>
        <Auth view="signIn" />
        <small className="text-muted-foreground">仅受邀家庭成员可登录</small>
      </div>
    </main>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const session = useSession(authClient)
  const pathname = appPath(usePathname())
  const router = useRouter()
  const [memberAccess, setMemberAccess] = useState<{
    userId: string
    role: string
  } | null>(null)
  const [roleError, setRoleError] = useState("")
  const userId = session.data?.user?.id
  const role = memberAccess?.userId === userId ? (memberAccess?.role ?? "") : ""

  useEffect(() => {
    if (!userId) return
    let active = true
    fetch("/family/api/me", { credentials: "include" })
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok)
          throw new Error(data.error?.message || "无法获取成员权限")
        if (active) setMemberAccess({ userId, role: data.role })
      })
      .catch((error: Error) => {
        if (active) setRoleError(error.message)
      })
    return () => {
      active = false
    }
  }, [userId])

  useEffect(() => {
    if (
      role &&
      role !== "ADMIN" &&
      (pathname === "/sms" || pathname === "/members")
    ) {
      router.replace("/")
    }
  }, [role, pathname, router])

  if (session.isPending)
    return (
      <main className="flex min-h-svh items-center justify-center">
        正在检查登录状态…
      </main>
    )
  if (!session.data?.user) return <SignInScreen />
  if (roleError)
    return (
      <main className="mx-auto max-w-xl p-6">
        <Alert variant="destructive">
          <AlertDescription>{roleError}</AlertDescription>
        </Alert>
      </main>
    )
  if (
    !role ||
    (role !== "ADMIN" && (pathname === "/sms" || pathname === "/members"))
  )
    return (
      <main className="flex min-h-svh items-center justify-center">
        正在加载…
      </main>
    )

  return (
    <RoleContext.Provider value={role}>
      <SidebarProvider>
        <AppSidebar role={role} email={session.data.user.email} />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger />
            <Separator orientation="vertical" className="h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbPage>
                    窝事 / {titles[pathname] || "快递"}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </header>
          <main className="mx-auto w-full max-w-7xl flex-1 p-4 md:p-8">
            {children}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </RoleContext.Provider>
  )
}
