"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Bell,
  LogOut,
  Menu,
  X,
  Settings,
  LayoutDashboard,
  Tractor,
  Sprout,
  DollarSign,
  FileText,
  BarChart3,
  Lightbulb,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { CompanyProvider } from "@/app/context/company-context"
import { useAuth } from "@/app/context/auth-context"
import { UserProfile } from "@/components/navigation/user-profile"
import { WelcomeModal } from "@/components/welcome-modal"
import { SafeImage } from "@/components/ui/safe-image"
import { NotificationsDrawer } from "@/components/notifications/notifications-drawer"
import { ProtectedLayout } from "@/app/dashboard/ProtectedLayout"
export default function DashboardLayoutWrapper({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const sidebarRef = useRef<HTMLDivElement>(null)
  const { user: authUser } = useAuth()

  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [viewMode, setViewMode] = useState<"user" | "admin">("admin")
  const [showWelcomeModal, setShowWelcomeModal] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)

  useEffect(() => {
    setMounted(true)

    try {
      const savedViewMode =
        (localStorage.getItem("viewMode") as "user" | "admin") || "admin"
      setViewMode(savedViewMode)
    } catch (err) {
      setViewMode("admin")
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (
        sidebarRef.current &&
        !sidebarRef.current.contains(event.target as Node)
      ) {
        setIsExpanded(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const toggleViewMode = () => {
    const newMode = viewMode === "admin" ? "user" : "admin"
    setViewMode(newMode)
    localStorage.setItem("viewMode", newMode)
  }

  const navigation = [
    { name: "Overview", href: "/dashboard/overview", icon: LayoutDashboard },
    { name: "Dashboard", href: "/dashboard/dashboard", icon: BarChart3 },
    { name: "Farms", href: "/dashboard/farms", icon: Tractor },
    { name: "Crops", href: "/dashboard/crops", icon: Sprout },
    { name: "Finance", href: "/dashboard/finance", icon: DollarSign },
    { name: "Reports", href: "/dashboard/reports", icon: FileText },
    { name: "Insights", href: "/dashboard/insights", icon: Lightbulb },
    { name: "Settings", href: "/dashboard/settings", icon: Settings },
  ]

  if (!mounted) {
    return <div className="h-screen bg-gray-50" />
  }

  return (
    <ProtectedLayout>
      <CompanyProvider>
        <div className="flex h-screen bg-gray-50 overflow-hidden">
        <WelcomeModal
          isOpen={showWelcomeModal}
          onClose={() => setShowWelcomeModal(false)}
        />
        <NotificationsDrawer
          isOpen={isNotificationsOpen}
          onClose={() => setIsNotificationsOpen(false)}
        />

        {/* Sidebar */}
        <div
          ref={sidebarRef}
          className={cn(
            "hidden md:flex md:flex-col transition-all duration-500 relative z-20 flex-shrink-0",
            isExpanded ? "md:w-64" : "md:w-16"
          )}
          onMouseEnter={() => setIsExpanded(true)}
          onMouseLeave={() => setIsExpanded(false)}
        >
          <div className="flex flex-col flex-1 pt-5 bg-[#387F43] text-white">
            <div
              className={cn(
                "flex items-center mb-5",
                isExpanded ? "px-4" : "px-2 justify-center"
              )}
            >
              <SafeImage
                src="/images/growteq-logo-white.svg"
                alt="Growteq Logo"
                width={150}
                height={40}
                fallback={<span>Growteq</span>}
              />
            </div>

            <div
              className={cn(
                "flex flex-col space-y-1 flex-1 overflow-y-auto",
                isExpanded ? "px-3" : "px-2"
              )}
            >
              {navigation.map((item) => {
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      "flex items-center py-3 rounded-md transition-all",
                      isExpanded ? "px-3" : "px-2 justify-center",
                      isActive
                        ? "bg-[#2d6535] text-white"
                        : "text-white hover:bg-[#2d6535]"
                    )}
                  >
                    <item.icon
                      className={cn("h-5 w-5", isExpanded ? "mr-3" : "")}
                    />
                    {isExpanded && (
                      <span className="text-sm font-medium">
                        {item.name}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>

            <div className="p-3">
              <Link
                href="/logout"
                className="flex items-center px-3 py-3 text-white hover:bg-[#2d6535] rounded-md"
              >
                <LogOut className="mr-3 h-5 w-5" />
                {isExpanded && "Sign Out"}
              </Link>
            </div>
          </div>
        </div>

        {/* Main */}
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="sticky top-0 z-10 flex items-center justify-between h-16 px-6 bg-white border-b">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setIsMobileNavOpen(true)}
            >
              <Menu className="h-6 w-6" />
            </Button>

            <div className="flex items-center ml-auto space-x-4">
              <UserProfile
                name={authUser?.name ?? "User"}
                email={authUser?.email ?? ""}
                company="User"
              />
            </div>
          </div>

          <main className="flex-1 p-6 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
      </CompanyProvider>
    </ProtectedLayout>
  )
}
