"use client"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { LogOut, Settings, Clock } from "lucide-react"
import { useAuth } from "@/app/context/auth-context"

interface UserProfileProps {
  name: string
  email: string
  company?: string
  avatarUrl?: string
  lastLogin?: string
}

const defaultLastLogin = "2024-01-15 09:30 AM"

export function UserProfile({
  name,
  email,
  company,
  lastLogin = defaultLastLogin,
}: UserProfileProps) {
  const { logout } = useAuth()

  const handleLogout = () => {
    logout()
  }

  const firstLetter = (name.trim().split(/\s+/)[0]?.[0] ?? name[0] ?? "U").toUpperCase()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center space-x-2 cursor-pointer">
          <div
            className="h-8 w-8 rounded-full bg-[#15803d] text-white flex items-center justify-center text-sm font-semibold shrink-0"
            aria-hidden
          >
            {firstLetter}
          </div>
          <div className="hidden md:flex md:flex-col md:items-start">
            <span className="font-medium text-sm">{name}</span>
            {company && <span className="text-xs text-muted-foreground">{company}</span>}
          </div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>
          <div className="flex flex-col">
            <span>{name}</span>
            {company && <span className="text-xs text-muted-foreground font-normal">{company}</span>}
            <span className="text-xs text-muted-foreground">{email}</span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="px-2 py-2">
          <div className="flex items-center space-x-2 text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded-md">
            <Clock className="h-4 w-4 text-[#3E2C80]" />
            <span className="text-xs">Last login:</span>
            <span className="text-xs font-medium">{lastLogin}</span>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <Settings className="mr-2 h-4 w-4" />
          <span>Settings</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
