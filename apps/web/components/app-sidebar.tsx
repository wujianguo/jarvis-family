"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"
import {
  LogOut,
  MessageSquare,
  Moon,
  Package,
  Settings,
  Sun,
  Users,
} from "lucide-react"
import { authClient } from "@/lib/auth/client"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@workspace/ui/components/sidebar"

export function appPath(pathname: string) {
  return pathname.replace(/^\/family(?=\/|$)/, "") || "/"
}

export function AppSidebar({ role, email }: { role: string; email: string }) {
  const pathname = appPath(usePathname())
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const { isMobile, setOpenMobile } = useSidebar()

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0)
    return () => clearTimeout(timer)
  }, [])

  const links = [
    { title: "快递", href: "/", icon: Package },
    ...(role === "ADMIN"
      ? [
          { title: "SMS 接入", href: "/sms", icon: MessageSquare },
          { title: "家庭成员", href: "/members", icon: Users },
        ]
      : []),
  ]

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              tooltip="窝事"
              render={<Link href="/" />}
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Package className="size-4" />
              </span>
              <span className="grid text-left leading-tight">
                <strong>窝事</strong>
                <small className="text-muted-foreground">家庭快递管家</small>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {links.map(({ title, href, icon: Icon }) => (
              <SidebarMenuItem key={href}>
                <SidebarMenuButton
                  tooltip={title}
                  isActive={pathname === href}
                  render={
                    <Link
                      href={href}
                      onClick={() => isMobile && setOpenMobile(false)}
                    />
                  }
                >
                  <Icon />
                  <span>{title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="设置"
              isActive={pathname === "/settings"}
              render={
                <Link
                  href="/settings"
                  onClick={() => isMobile && setOpenMobile(false)}
                />
              }
            >
              <Settings />
              <span>设置</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="切换主题"
              onClick={() =>
                setTheme(resolvedTheme === "dark" ? "light" : "dark")
              }
              disabled={!mounted}
            >
              {mounted && resolvedTheme === "dark" ? <Sun /> : <Moon />}
              <span>切换主题</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip={email}>
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium">
                {email.slice(0, 1).toUpperCase()}
              </span>
              <span className="truncate text-sm">{email}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="退出登录"
              onClick={() => void authClient.signOut()}
            >
              <LogOut />
              <span>退出登录</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
