"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"
import {
  ChevronsUpDown,
  KeyRound,
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
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
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

export function AppSidebar({
  role,
  user,
}: {
  role: string
  user: { name: string; email: string; image?: string | null }
}) {
  const pathname = appPath(usePathname())
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const { isMobile, setOpenMobile } = useSidebar()
  const displayName = user.name || user.email.split("@")[0] || user.email

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
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <SidebarMenuButton
                    size="lg"
                    tooltip={displayName}
                    className="data-[state=open]:bg-sidebar-accent"
                  />
                }
              >
                <Avatar className="size-8">
                  {user.image && (
                    <AvatarImage src={user.image} alt={displayName} />
                  )}
                  <AvatarFallback>
                    {displayName.slice(0, 1).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="grid min-w-0 flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{displayName}</span>
                  <span className="truncate text-xs">{user.email}</span>
                </span>
                <ChevronsUpDown className="ml-auto size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side={isMobile ? "bottom" : "right"}
                align="end"
                className="min-w-56"
              >
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="flex items-center gap-2">
                    <Avatar className="size-8">
                      {user.image && (
                        <AvatarImage src={user.image} alt={displayName} />
                      )}
                      <AvatarFallback>
                        {displayName.slice(0, 1).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="grid min-w-0 text-left leading-tight">
                      <span className="truncate">{displayName}</span>
                      <span className="truncate font-normal">{user.email}</span>
                    </span>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem
                    render={<Link href="/settings/account" />}
                    onClick={() => isMobile && setOpenMobile(false)}
                  >
                    <Settings />
                    个人信息与账户设置
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    render={<Link href="/settings/security" />}
                    onClick={() => isMobile && setOpenMobile(false)}
                  >
                    <KeyRound />
                    管理 API Key
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={!mounted}
                    onClick={() =>
                      setTheme(resolvedTheme === "dark" ? "light" : "dark")
                    }
                  >
                    {mounted && resolvedTheme === "dark" ? <Sun /> : <Moon />}
                    切换主题
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={() => void authClient.signOut()}>
                    <LogOut />
                    退出登录
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
