"use client"

import { use } from "react"
import { Settings } from "@/components/auth/settings/settings"

export default function SettingsViewPage({
  params,
}: {
  params: Promise<{ path: string }>
}) {
  const { path } = use(params)
  return <Settings path={path} />
}
