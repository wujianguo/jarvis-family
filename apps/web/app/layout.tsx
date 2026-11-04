import "@workspace/ui/globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { AppProviders } from "@/components/app-providers"
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider>
          <AppProviders>{children}</AppProviders>
        </ThemeProvider>
      </body>
    </html>
  )
}
