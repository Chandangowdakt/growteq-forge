"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LogOut,
  Menu,
  Settings,
  LayoutDashboard,
  Tractor,
  Sprout,
  DollarSign,
  FileText,
  BarChart3,
  Lightbulb,
  ClipboardList,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { CompanyProvider } from "@/app/context/company-context"
import { useAuth } from "@/app/context/auth-context"
import { UserProfile } from "@/components/navigation/user-profile"
import { WelcomeModal } from "@/components/welcome-modal"
import { NotificationsDrawer } from "@/components/notifications/notifications-drawer"
import { GrowteqLogo } from "@/components/brand/growteq-logo"
import { ProtectedLayout } from "@/app/dashboard/ProtectedLayout"
import { canReadModule } from "@/lib/permissions"
export default function DashboardLayoutWrapper({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const sidebarRef = useRef<HTMLDivElement>(null)
  const { user: authUser, logout } = useAuth()

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
    { name: "Evaluations", href: "/dashboard/site-evaluations", icon: ClipboardList },
    { name: "Finance", href: "/dashboard/finance", icon: DollarSign },
    { name: "Reports", href: "/dashboard/reports", icon: FileText },
    { name: "Insights", href: "/dashboard/insights", icon: Lightbulb },
    { name: "Settings", href: "/dashboard/settings", icon: Settings },
  ]
  const filteredNavigation = navigation.filter((item) => {
    if (item.href === "/dashboard/settings") return canReadModule(authUser, "settings")
    if (item.href === "/dashboard/finance") return canReadModule(authUser, "finance")
    if (item.href === "/dashboard/reports") return canReadModule(authUser, "reports")
    if (item.href === "/dashboard/site-evaluations") return canReadModule(authUser, "evaluations")
    if (item.href === "/dashboard/farms" || item.href === "/dashboard/crops") {
      return canReadModule(authUser, "farms")
    }
    if (item.href === "/dashboard/dashboard" || item.href === "/dashboard/insights") {
      return canReadModule(authUser, "farms")
    }
    if (item.href === "/dashboard/overview") return canReadModule(authUser, "farms")
    return true
  })

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
                "flex flex-col items-start mb-5",
                isExpanded ? "px-4" : "px-2 items-center w-full"
              )}
            >
              {isExpanded ? (
                <GrowteqLogo variant="sidebar" href="/dashboard/overview" className="h-10" />
              ) : (
                <GrowteqLogo
                  variant="collapsed"
                  href="/dashboard/overview"
                  className="h-9 w-9 object-contain mx-auto"
                />
              )}
            </div>

            <div
              className={cn(
                "flex flex-col space-y-1 flex-1 overflow-y-auto",
                isExpanded ? "px-3" : "px-2"
              )}
            >
              {filteredNavigation.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/dashboard/overview" && pathname.startsWith(`${item.href}/`))
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
              <button
                type="button"
                onClick={logout}
                className="flex items-center w-full px-3 py-3 text-white hover:bg-[#2d6535] rounded-md"
              >
                <LogOut className="mr-3 h-5 w-5 flex-shrink-0" />
                {isExpanded && "Sign Out"}
              </button>
            </div>
          </div>
        </div>

        {/* Main */}
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="sticky top-0 z-10 flex items-center justify-between gap-3 h-16 px-4 sm:px-6 bg-white border-b">
            <div className="flex items-center gap-2 min-w-0 md:min-w-0 md:flex-initial">
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden shrink-0"
                onClick={() => setIsMobileNavOpen(true)}
                aria-label="Open menu"
              >
                <Menu className="h-6 w-6" />
              </Button>
              <div className="md:hidden min-w-0 flex-1">
                <GrowteqLogo variant="default" href="/dashboard/overview" className="h-8 max-h-8" />
              </div>
            </div>

            <div className="flex items-center ml-auto space-x-4 shrink-0">
              <UserProfile
                name={
                  authUser
                    ? [authUser.firstName, authUser.lastName].filter(Boolean).join(" ") || authUser.name || "User"
                    : "User"
                }
                email={authUser?.email ?? ""}
                company={authUser?.role ?? "User"}
              />
            </div>
          </div>

          <main className="flex-1 p-6 overflow-y-auto">
            {children}
          </main>
        </div>

        <Sheet open={isMobileNavOpen} onOpenChange={setIsMobileNavOpen}>
          <SheetContent
            side="left"
            className="w-[min(100vw-2rem,18rem)] border-0 bg-[#387F43] p-0 text-white [&>button]:text-white [&>button]:hover:bg-white/15 [&>button]:hover:text-white"
          >
            <div className="flex h-full flex-col pt-2">
              <div className="border-b border-white/15 px-4 pb-4 pr-12">
                <GrowteqLogo
                  variant="sidebar"
                  href="/dashboard/overview"
                  className="h-9"
                  onNavigate={() => setIsMobileNavOpen(false)}
                />
              </div>
              <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
                {filteredNavigation.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== "/dashboard/overview" && pathname.startsWith(`${item.href}/`))
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setIsMobileNavOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium",
                        isActive ? "bg-[#2d6535] text-white" : "text-white hover:bg-[#2d6535]"
                      )}
                    >
                      <item.icon className="h-5 w-5 shrink-0" />
                      {item.name}
                    </Link>
                  )
                })}
              </nav>
              <div className="border-t border-white/15 p-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileNavOpen(false)
                    logout()
                  }}
                  className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-sm font-medium text-white hover:bg-[#2d6535]"
                >
                  <LogOut className="h-5 w-5 shrink-0" />
                  Sign Out
                </button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
      </CompanyProvider>
    </ProtectedLayout>
  )
}
