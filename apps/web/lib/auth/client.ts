import { createAuthClient } from "better-auth/react"
import { apiKeyClient } from "better-auth/client/plugins"

export const authClient = createAuthClient({
  plugins: [apiKeyClient()],
  baseURL:
    typeof window === "undefined"
      ? "http://localhost:3001/api/auth"
      : `${location.origin}/family/api/auth`,
})
