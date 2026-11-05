"use client"

import { useState } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { AuthProvider } from "@/components/auth/auth-provider"
import { authClient } from "@/lib/auth/client"
import { Toaster } from "@workspace/ui/components/sonner"
import { TooltipProvider } from "@workspace/ui/components/tooltip"

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider
        authClient={authClient}
        queryClient={queryClient}
        basePaths={{ auth: "/family/auth", settings: "/family/settings" }}
        redirectTo="/family"
        emailAndPassword={{
          enabled: true,
          forgotPassword: false,
          minPasswordLength: 8,
        }}
        navigate={({ to, replace }) => {
          if (replace) window.location.replace(to)
          else window.location.assign(to)
        }}
      >
        <TooltipProvider>
          {children}
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
