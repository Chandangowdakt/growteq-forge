"use client"

import { type ReactNode, useEffect } from "react"
import { AuthProvider } from "@/app/context/auth-context"
import { Toaster } from "@/components/ui/toaster"
import { NetworkErrorBanner } from "@/components/network-error-banner"

function BackendWarmupPing() {
  useEffect(() => {
    const base =
      (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL) || "http://localhost:5000"
    fetch(`${base.replace(/\/$/, "")}/health`, { method: "GET", cache: "no-store" }).catch(() => {})
  }, [])
  return null
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <BackendWarmupPing />
      <NetworkErrorBanner />
      {children}
      <Toaster />
    </AuthProvider>
  )
}
