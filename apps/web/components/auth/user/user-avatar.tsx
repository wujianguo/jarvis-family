"use client"

import { useSession } from "@better-auth-ui/react"
import { authClient } from "@/lib/auth/client"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar"

export function UserAvatar({
  className,
}: {
  className?: string
  isPending?: boolean
}) {
  const { data } = useSession(authClient)
  const user = data?.user
  return (
    <Avatar className={className}>
      {user?.image && (
        <AvatarImage src={user.image} alt={user.name || user.email} />
      )}
      <AvatarFallback>
        {(user?.name || user?.email || "?").slice(0, 1).toUpperCase()}
      </AvatarFallback>
    </Avatar>
  )
}
