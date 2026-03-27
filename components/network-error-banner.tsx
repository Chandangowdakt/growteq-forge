"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { WifiOff } from "lucide-react"

export const FORGE_NETWORK_ERROR_EVENT = "forge-network-error"

export function NetworkErrorBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onErr = () => setVisible(true)
    window.addEventListener(FORGE_NETWORK_ERROR_EVENT, onErr)
    return () => window.removeEventListener(FORGE_NETWORK_ERROR_EVENT, onErr)
  }, [])

  const retry = useCallback(() => {
    setVisible(false)
    window.location.reload()
  }, [])

  if (!visible) return null

  return (
    <div
      role="alert"
      className="fixed top-0 left-0 right-0 z-[200] flex flex-wrap items-center justify-center gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-950 shadow-sm"
    >
      <span className="flex items-center gap-2 font-medium">
        <WifiOff className="h-4 w-4 shrink-0" />
        Network error — we couldn&apos;t reach the server.
      </span>
      <Button type="button" size="sm" variant="outline" className="h-8 border-amber-300 bg-white" onClick={retry}>
        Retry
      </Button>
      <button
        type="button"
        className="text-xs text-amber-800 underline underline-offset-2 hover:text-amber-950"
        onClick={() => setVisible(false)}
      >
        Dismiss
      </button>
    </div>
  )
}
