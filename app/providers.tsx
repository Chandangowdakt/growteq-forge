"use client"

import { type ReactNode } from "react"
import { AuthProvider } from "@/app/context/auth-context"
import { Toaster } from "@/components/ui/toaster"

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      {children}
      <Toaster />
    </AuthProvider>
  )
}
