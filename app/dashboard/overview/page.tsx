"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { AlertCircle, ClipboardList } from "lucide-react"
import { dashboardApi, userRequestsApi } from "@/lib/api"
import { isAdminRole } from "@/lib/permissions"
import { Skeleton } from "@/components/ui/skeleton"
import { formatINR } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"
import { DashboardPageGuard } from "@/components/dashboard/dashboard-page-guard"
import { useAuth } from "@/app/context/auth-context"

interface SummaryData {
  totalSites: number
  totalArea: number
  totalProposals: number
  pipelineValue: number
  averageROI: number
  revenueTrend: { month: string; value: number }[]
}

function numField(v: unknown, fallback = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return v
  return fallback
}

/** Map alternate / legacy dashboard summary keys and trend row shapes to the UI model. */
function normalizeDashboardSummary(raw: Record<string, unknown> | null | undefined): SummaryData {
  const s = raw ?? {}
  const trendRaw = s.revenueTrend ?? s.monthlyRevenue
  const arr = Array.isArray(trendRaw) ? trendRaw : []

  const revenueTrend: { month: string; value: number }[] = []
  for (const item of arr) {
    if (!item || typeof item !== "object") continue
    const o = item as Record<string, unknown>
    if (typeof o.month === "string" && typeof o.value === "number") {
      revenueTrend.push({ month: o.month, value: o.value })
      continue
    }
    if (typeof o.month === "string" && typeof o.revenue === "number") {
      revenueTrend.push({ month: o.month, value: o.revenue })
      continue
    }
    const id = o._id
    if (id && typeof id === "object") {
      const ido = id as Record<string, unknown>
      const m = ido.month
      const y = ido.year
      const total = o.total
      if (typeof total === "number") {
        let monthLabel: string
        if (typeof y === "number" && typeof m === "number") {
          monthLabel = `${y}-${String(m).padStart(2, "0")}`
        } else if (typeof m === "string" || typeof m === "number") {
          monthLabel = String(m)
        } else {
          monthLabel = "—"
        }
        revenueTrend.push({ month: monthLabel, value: total })
        continue
      }
    }
    if (typeof o.total === "number") {
      revenueTrend.push({
        month: typeof o.month === "string" ? o.month : "—",
        value: o.total,
      })
    }
  }

  return {
    totalSites: numField(s.totalSites ?? s.activeSites),
    totalArea: numField(s.totalArea ?? s.totalLandArea),
    totalProposals: numField(s.totalProposals ?? s.totalFarms),
    pipelineValue: numField(s.pipelineValue ?? s.totalRevenue),
    averageROI: numField(s.averageROI),
    revenueTrend,
  }
}

function OverviewPageContent() {
  const { user } = useAuth()
  const [data, setData] = useState<SummaryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendingApprovals, setPendingApprovals] = useState<number | null>(null)

  const fetchSummary = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // Initialize with safe defaults before loading real data
      setData({
        totalSites: 0,
        totalArea: 0,
        totalProposals: 0,
        pipelineValue: 0,
        averageROI: 0,
        revenueTrend: [],
      })

      const res = await dashboardApi.summary()
      setData(
        normalizeDashboardSummary((res?.data ?? {}) as unknown as Record<string, unknown>)
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load dashboard")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSummary()
  }, [fetchSummary])

  useEffect(() => {
    if (!isAdminRole(user?.role)) {
      setPendingApprovals(null)
      return
    }
    userRequestsApi
      .listPending()
      .then((res) => {
        const n = Array.isArray(res?.data) ? res.data.length : 0
        setPendingApprovals(n)
      })
      .catch(() => setPendingApprovals(0))
  }, [user?.role])

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        <Skeleton className="h-9 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="rounded-2xl shadow-sm">
              <CardHeader className="p-6 space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-8 w-20" />
              </CardHeader>
            </Card>
          ))}
        </div>
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-64 mt-2" />
          </CardHeader>
          <CardContent className="p-6">
            <Skeleton className="h-80 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-8">
        <Card className="border-l-4 border-l-destructive rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive text-xl font-semibold">
              <AlertCircle className="h-5 w-5" />
              Error loading dashboard
            </CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={fetchSummary} variant="outline">
              Try again
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!data) return null

  const {
    totalSites,
    totalArea,
    totalProposals,
    pipelineValue,
    averageROI,
    revenueTrend,
  } = data

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
      <h1 className="text-3xl font-bold mb-2">Overview</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {isAdminRole(user?.role) && pendingApprovals != null && (
          <Card className="rounded-2xl shadow-sm border-l-4 border-l-amber-500">
            <CardHeader className="p-6">
              <CardDescription className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                <ClipboardList className="h-3.5 w-3.5" />
                Pending approvals
              </CardDescription>
              <CardTitle className="text-2xl font-semibold">{pendingApprovals}</CardTitle>
              <Button variant="link" className="h-auto p-0 text-[#387F43]" asChild>
                <Link href="/dashboard/settings">Review in Settings →</Link>
              </Button>
            </CardHeader>
          </Card>
        )}
        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="p-6">
            <CardDescription className="text-xs uppercase tracking-wide text-muted-foreground">
              Total Sites
            </CardDescription>
            <CardTitle className="text-2xl font-semibold">{totalSites}</CardTitle>
          </CardHeader>
        </Card>

        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="p-6">
            <CardDescription className="text-xs uppercase tracking-wide text-muted-foreground">
              Total Area (acres)
            </CardDescription>
            <CardTitle className="text-2xl font-semibold">
              {Number(totalArea).toLocaleString("en-IN", { maximumFractionDigits: 1, minimumFractionDigits: 0 })}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="p-6">
            <CardDescription className="text-xs uppercase tracking-wide text-muted-foreground">
              Total Proposals
            </CardDescription>
            <CardTitle className="text-2xl font-semibold">{totalProposals}</CardTitle>
          </CardHeader>
        </Card>

        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="p-6">
            <CardDescription className="text-xs uppercase tracking-wide text-muted-foreground">
              Pipeline Value (₹)
            </CardDescription>
            <CardTitle className="text-2xl font-semibold">
              {formatINR(pipelineValue)}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="p-6">
            <CardDescription className="text-xs uppercase tracking-wide text-muted-foreground">
              Average ROI (months)
            </CardDescription>
            <CardTitle className="text-2xl font-semibold">
              {averageROI > 0
                ? `${averageROI.toLocaleString("en-IN", { maximumFractionDigits: 1 })} mo`
                : "N/A"}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl font-semibold">Revenue Trend</CardTitle>
          <CardDescription>Proposal investment value by month (last 6 months)</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          {revenueTrend.length > 0 ? (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={revenueTrend}
                  margin={{ top: 10, right: 30, left: 80, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis
                    width={70}
                    tickFormatter={(value: number) =>
                      value >= 100000
                        ? `₹${(value / 100000).toFixed(0)}L`
                        : `₹${value.toLocaleString("en-IN")}`
                    }
                  />
                  <Tooltip formatter={(value: number) => [`₹${Number(value).toLocaleString("en-IN")}`, "Value"]} />
                  <Bar dataKey="value" fill="#387F43" name="Investment (₹)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-80 flex items-center justify-center text-sm text-muted-foreground">
              No revenue trend data yet.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function OverviewPage() {
  return (
    <DashboardPageGuard module="farms">
      <OverviewPageContent />
    </DashboardPageGuard>
  )
}