"use client"

import type { ReactNode } from "react"
import { useAuth } from "@/app/context/auth-context"
import { canReadModule, type PermissionModule } from "@/lib/permissions"

export function DashboardPageGuard({
  module,
  children,
}: {
  module: PermissionModule
  children: ReactNode
}) {
  const { user } = useAuth()
  if (!canReadModule(user, module)) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-center max-w-md px-4">
          <h2 className="text-lg font-semibold text-gray-800">Access restricted</h2>
          <p className="text-sm text-muted-foreground mt-2">
            You don&apos;t have permission to view this page. Contact your administrator if you need access.
          </p>
        </div>
      </div>
    )
  }
  return <>{children}</>
}
