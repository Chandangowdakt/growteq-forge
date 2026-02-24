"use client"

import { Clock } from "lucide-react"

interface LastLoginInfoProps {
  lastLogin?: string
}

export function LastLoginInfo({ lastLogin = "2024-01-15 09:30 AM" }: LastLoginInfoProps) {
  return (
    <div className="flex items-center space-x-2 text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded-md">
      <Clock className="h-4 w-4 text-[#3E2C80]" />
      <span className="hidden sm:inline">Last login:</span>
      <span className="font-medium">{lastLogin}</span>
    </div>
  )
}
