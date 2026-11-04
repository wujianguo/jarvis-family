import { createAuthClient } from "better-auth/react"

export const authClient = createAuthClient({
  baseURL:
    typeof window === "undefined"
      ? "http://localhost:3001/api/auth"
      : `${location.origin}/family/api/auth`,
})
