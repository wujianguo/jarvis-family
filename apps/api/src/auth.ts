import { betterAuth } from "better-auth"
import { prismaAdapter } from "better-auth/adapters/prisma"
import { bearer } from "better-auth/plugins"
import { db } from "@workspace/db"

const publicURL = process.env.BETTER_AUTH_URL || "http://localhost:3001/api/auth"
export const auth = betterAuth({
  appName: "窝事",
  baseURL: publicURL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: prismaAdapter(db, { provider: "postgresql" }),
  emailAndPassword: { enabled: true, disableSignUp: true },
  plugins: [bearer()],
  trustedOrigins: [new URL(publicURL).origin],
  advanced: { useSecureCookies: publicURL.startsWith("https:"), defaultCookieAttributes: { path: "/family", sameSite: "lax", httpOnly: true, secure: publicURL.startsWith("https:") } },
  rateLimit: { enabled: true, storage: "database", window: 60, max: 100 },
})
