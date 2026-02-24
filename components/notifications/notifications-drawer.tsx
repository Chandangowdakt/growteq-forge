"use client"

import { useState, useCallback, useEffect } from "react"
import { X, Bell, Circle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { notificationsApi, type NotificationItem as ApiNotification } from "@/lib/api"
import { formatDistanceToNow } from "date-fns"

interface NotificationItem {
  id: string
  user: { name: string; avatar: string }
  action: string
  content: string
  timestamp: string
  isRead: boolean
  isNew: boolean
}

function formatNotification(n: ApiNotification): NotificationItem {
  return {
    id: n._id,
    user: {
      name: n.user?.name ?? "System",
      avatar: n.user?.avatar ?? "",
    },
    action: n.action,
    content: n.content,
    timestamp: formatDistanceToNow(new Date(n.createdAt), { addSuffix: true }),
    isRead: n.isRead,
    isNew: n.isNew,
  }
}

const fallbackNotifications: NotificationItem[] = [
  {
    id: "1",
    user: { name: "System", avatar: "" },
    action: "Welcome to Forge",
    content: "Your farm infrastructure planning dashboard is ready.",
    timestamp: "just now",
    isRead: false,
    isNew: true,
  },
]

interface NotificationsDrawerProps {
  isOpen: boolean
  onClose: () => void
}

export function NotificationsDrawer({ isOpen, onClose }: NotificationsDrawerProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>(fallbackNotifications)
  const [loading, setLoading] = useState(false)

  const fetchNotifications = useCallback(async () => {
    setLoading(true)
    try {
      const res = await notificationsApi.list()
      if (res.success && res.data.length > 0) {
        setNotifications(res.data.map(formatNotification))
      }
    } catch {
      // Keep fallback when API unavailable or unauthenticated
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen) fetchNotifications()
  }, [isOpen, fetchNotifications])

  const markAsRead = useCallback((notificationId: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, isRead: true, isNew: false } : n))
    )
    notificationsApi.markAsRead(notificationId).catch(() => {})
  }, [])

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true, isNew: false })))
    notificationsApi.markAllAsRead().catch(() => {})
  }, [])

  const unreadCount = notifications.filter((n) => !n.isRead).length

  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />}
      <div
        className={cn(
          "fixed top-0 right-0 h-full w-96 bg-white shadow-2xl transform transition-transform duration-300 ease-in-out z-50 flex flex-col",
          isOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <Bell className="h-5 w-5 text-[#3E2C80]" />
              {unreadCount > 0 && (
                <div className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 rounded-full flex items-center justify-center">
                  <span className="text-xs text-white font-medium">{unreadCount}</span>
                </div>
              )}
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Notifications</h2>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllAsRead}
                className="text-xs text-[#3E2C80] hover:text-[#3E2C80] hover:bg-[#3E2C80]/10"
              >
                Mark all read
              </Button>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 text-gray-400 hover:text-gray-600">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="relative">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#3E2C80]" />
            <div className="pl-6 pr-6">
              {loading ? (
                <p className="py-8 text-center text-sm text-gray-500">Loading...</p>
              ) : (
                notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={cn(
                      "py-4 border-b border-gray-50 last:border-b-0 cursor-pointer transition-colors hover:bg-gray-50",
                      !notification.isRead && "bg-[#3E2C80]/5",
                      notification.isNew && "bg-[#3E2C80]/10 border-l-2 border-l-[#3E2C80] ml-[-1px]",
                    )}
                    onClick={() => markAsRead(notification.id)}
                  >
                    <div className="flex space-x-3">
                      <div className="flex-shrink-0 relative">
                        {notification.user.avatar ? (
                          <img
                            src={notification.user.avatar}
                            alt={notification.user.name}
                            className="h-10 w-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-[#3E2C80]/20 flex items-center justify-center">
                            <span className="text-sm font-medium text-[#3E2C80]">
                              {notification.user.name.charAt(0)}
                            </span>
                          </div>
                        )}
                        {!notification.isRead && (
                          <div className="absolute -top-1 -right-1">
                            <Circle
                              className={cn(
                                "h-3 w-3 fill-current",
                                notification.isNew ? "text-red-500" : "text-[#3E2C80]",
                              )}
                            />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              <p className="text-sm">
                                <span
                                  className={cn(
                                    "font-medium text-[#3E2C80]",
                                    !notification.isRead && "font-semibold",
                                  )}
                                >
                                  {notification.user.name}
                                </span>
                              </p>
                              {notification.isNew && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                  NEW
                                </span>
                              )}
                            </div>
                            <p
                              className={cn(
                                "text-sm text-gray-500 mt-0.5",
                                !notification.isRead && "text-gray-700 font-medium",
                              )}
                            >
                              {notification.action}
                            </p>
                            {notification.content && (
                              <p
                                className={cn(
                                  "text-sm text-gray-900 mt-1",
                                  !notification.isRead ? "font-semibold" : "font-medium",
                                )}
                              >
                                {notification.content}
                              </p>
                            )}
                          </div>
                          <span
                            className={cn(
                              "text-xs ml-2 flex-shrink-0",
                              notification.isRead ? "text-gray-400" : "text-gray-600 font-medium",
                            )}
                          >
                            {notification.timestamp}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-gray-100">
          <Button variant="ghost" className="w-full text-[#3E2C80] hover:text-[#3E2C80] hover:bg-[#3E2C80]/10">
            See all incoming activity
          </Button>
        </div>
      </div>
    </>
  )
}
