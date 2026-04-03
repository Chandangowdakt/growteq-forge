"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, Target, AlertCircle, BarChart3 } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { insightsApi } from "@/lib/api"
import { DashboardPageGuard } from "@/components/dashboard/dashboard-page-guard"

const defaultByMonth = [
  { month: "Jan", approved: 1, drafted: 4, submitted: 2 },
  { month: "Feb", approved: 2, drafted: 6, submitted: 3 },
  { month: "Mar", approved: 3, drafted: 8, submitted: 5 },
]

const defaultRoiProjection = [
  { month: 1, polyhouse: 0, shade_net: 0, open_field: 0 },
  { month: 3, polyhouse: 8, shade_net: 12, open_field: 15 },
  { month: 6, polyhouse: 18, shade_net: 22, open_field: 28 },
  { month: 12, polyhouse: 35, shade_net: 40, open_field: 50 },
]

type PipelineByMonthRow = { month: string; approved: number; drafted: number; submitted: number }

function normalizePipelineByMonth(raw: unknown): PipelineByMonthRow[] {
  if (!Array.isArray(raw)) return []
  return raw.map((row) => {
    const r = row as Record<string, unknown>
    const month = typeof r.month === "string" ? r.month : typeof r._id === "string" ? r._id : "—"
    return {
      month,
      approved: typeof r.approved === "number" ? r.approved : 0,
      drafted: typeof r.drafted === "number" ? r.drafted : typeof r.draft === "number" ? r.draft : 0,
      submitted: typeof r.submitted === "number" ? r.submitted : 0,
    }
  })
}

function InsightsPageContent() {
  const [pipeline, setPipeline] = useState<{ byMonth?: PipelineByMonthRow[] } | null>(null)
  const [siteRankingData, setSiteRankingData] = useState<
    { siteId?: string; siteName?: string; score?: number; roiMonths?: number | null; infrastructureType?: string | null }[]
  >([])
  const [roiDistribution, setRoiDistribution] = useState<{ month: number; polyhouse: number; shade_net: number; open_field: number }[]>([])
  const [pipelineValue, setPipelineValue] = useState<number>(0)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(() => {
    setError(null)
    setLoading(true)
    let cancelled = false
    Promise.all([
      insightsApi.pipeline(),
      insightsApi.siteRanking(),
      insightsApi.roiDistribution(),
    ])
      .then(([pRes, rRes, roiRes]) => {
        if (cancelled) return
        if (pRes?.data) {
          const byMonth = normalizePipelineByMonth(pRes.data.byMonth)
          setPipeline(byMonth.length ? { byMonth } : { byMonth: undefined })
          setPipelineValue(
            typeof pRes.data.totalPipelineValue === "number" ? pRes.data.totalPipelineValue : 0
          )
        } else {
          setPipeline(null)
          setPipelineValue(0)
        }
        if (Array.isArray(rRes?.data)) {
          setSiteRankingData(
            rRes.data.map((s) => ({
              siteId: s.siteId,
              siteName: s.siteName ?? s.name ?? `Site ${String(s.siteId).slice(-6)}`,
              score: typeof s.score === "number" ? s.score : 0,
              roiMonths: s.roiMonths,
              infrastructureType: s.infrastructureType,
            }))
          )
        } else {
          setSiteRankingData([])
        }
        if (Array.isArray(roiRes?.data)) {
          setRoiDistribution(
            roiRes.data.map((r) => ({
              month: typeof r.month === "number" ? r.month : 0,
              polyhouse: typeof r.polyhouse === "number" ? r.polyhouse : 0,
              shade_net: typeof r.shade_net === "number" ? r.shade_net : 0,
              open_field: typeof r.open_field === "number" ? r.open_field : 0,
            }))
          )
        } else {
          setRoiDistribution([])
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load insights")
          console.error("Insights load error:", err)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const cleanup = loadData()
    return () => {
      cleanup?.()
    }
  }, [loadData])

  const pipelineChartData = useMemo(() => {
    const rows = pipeline?.byMonth?.length ? pipeline.byMonth : defaultByMonth
    return rows.map((row) => {
      let monthLabel = row.month
      if (/^\d{4}-\d{2}$/.test(row.month)) {
        const [y, m] = row.month.split("-").map(Number)
        monthLabel = new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "short", year: "2-digit" })
      }
      return { ...row, month: monthLabel }
    })
  }, [pipeline])

  const roiChartData = useMemo(() => {
    if (roiDistribution.length) {
      return roiDistribution.map((r) => ({
        month: `Month ${r.month}`,
        polyhouse: r.polyhouse,
        shade_net: r.shade_net,
        open_field: r.open_field,
      }))
    }
    return defaultRoiProjection.map((r) => ({
      month: `Month ${r.month}`,
      polyhouse: r.polyhouse,
      shade_net: r.shade_net,
      open_field: r.open_field,
    }))
  }, [roiDistribution])

  const siteRanking = useMemo(() => {
    if (siteRankingData.length) {
      return siteRankingData.map((s) => ({
        siteId: s.siteId,
        siteName: s.siteName ?? "Unnamed Site",
        score: s.score ?? 0,
        infrastructureType: s.infrastructureType ? String(s.infrastructureType).replace(/_/g, " ") : null,
        roiMonths: s.roiMonths != null ? s.roiMonths : null,
      }))
    }
    return [
      { siteId: "demo-1", siteName: "Hosahalli Farm", score: 92, infrastructureType: "Polyhouse", roiMonths: 18 },
      { siteId: "demo-2", siteName: "Kodigenahalli", score: 88, infrastructureType: "Polyhouse", roiMonths: 20 },
      { siteId: "demo-3", siteName: "Mudugere Farm", score: 82, infrastructureType: "Shade Net", roiMonths: 6 },
      { siteId: "demo-4", siteName: "Chikka Soluru", score: 75, infrastructureType: "Open Field", roiMonths: 3 },
    ]
  }, [siteRankingData])

  const pipelineValueCr = pipelineValue ? `₹${(pipelineValue / 10_000_000).toFixed(2)} Cr` : "₹0.00 Cr"

  const hasBackendPipeline = !!(pipeline?.byMonth && pipeline.byMonth.length > 0)
  const hasBackendRoi = roiDistribution.length > 0
  const hasBackendRanking = siteRankingData.length > 0
  const noRealInsights =
    !loading && !error && !hasBackendPipeline && !hasBackendRoi && !hasBackendRanking

  const pageHeader = (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">Insights</h1>
      <p className="text-muted-foreground">
        Market analysis and predictive insights for site evaluation strategy
      </p>
    </div>
  )

  if (loading) {
    return (
      <div className="space-y-6">
        {pageHeader}
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="border-l-4">
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-28" />
                </CardHeader>
                <CardContent className="space-y-2">
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-3 w-24" />
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-64 mt-2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-[300px] w-full" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-56 mt-2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-[300px] w-full" />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        {pageHeader}
        <Card className="max-w-lg border-destructive/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive text-lg">
              <AlertCircle className="h-5 w-5 shrink-0" />
              Failed to load insights
            </CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="bg-[#387F43] hover:bg-[#2d6535]" onClick={() => void loadData()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {pageHeader}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-[#387F43]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">50%</div>
            <p className="text-xs text-green-600 flex items-center gap-1 mt-1">
              <TrendingUp className="h-3 w-3" />
              +8% from last month
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Avg Site Quality</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">85/100</div>
            <p className="text-xs text-muted-foreground mt-1">Across all evaluations</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-600">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Avg ROI Potential</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">115%</div>
            <p className="text-xs text-muted-foreground mt-1">Across proposals</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pipeline Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pipelineValueCr}</div>
            <p className="text-xs text-muted-foreground mt-1">Pending investment</p>
          </CardContent>
        </Card>
      </div>

      {noRealInsights ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center rounded-xl border border-dashed border-muted-foreground/20 bg-muted/20">
          <BarChart3 className="h-12 w-12 text-muted-foreground/45 mb-3" />
          <p className="font-medium text-foreground">No data available</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-md">
            Insights will appear here once you have evaluations, proposals, and pipeline activity in the system.
          </p>
        </div>
      ) : (
      <>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Site Evaluation Pipeline</CardTitle>
            <CardDescription>Monthly progress through sales funnel</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={pipelineChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="approved" fill="#22c55e" name="Approved" />
                <Bar dataKey="drafted" fill="#fb923c" name="Drafted" />
                <Bar dataKey="submitted" fill="#3b82f6" name="Submitted" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>ROI Projection by Infrastructure</CardTitle>
            <CardDescription>Expected returns over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={roiChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value: number) => `₹${value}L`} />
                <Legend />
                <Line type="monotone" dataKey="polyhouse" stroke="#387F43" strokeWidth={2} name="Polyhouse" />
                <Line type="monotone" dataKey="shade_net" stroke="#f59e0b" strokeWidth={2} name="Shade Net" />
                <Line type="monotone" dataKey="open_field" stroke="#10b981" strokeWidth={2} name="Open Field" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-[#387F43]" />
            Site Suitability Ranking
          </CardTitle>
          <CardDescription>Overall site quality and recommended infrastructure</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {siteRanking.map((item) => (
              <div key={item.siteId ?? item.siteName} className="p-4 border rounded-lg hover:bg-gray-50">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold">{item.siteName}</p>
                      {item.infrastructureType && (
                        <Badge variant="secondary" className="text-xs">{item.infrastructureType}</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {item.roiMonths != null ? `ROI: ${item.roiMonths} months` : "—"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-[#387F43]">{item.score}</p>
                    <p className="text-xs text-muted-foreground">/ 100</p>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-[#387F43] h-2 rounded-full transition-all"
                    style={{ width: `${(item.score / 100) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Market Insights & Recommendations</CardTitle>
          <CardDescription>Strategic suggestions based on evaluation data</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="font-medium text-blue-900 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                High Demand Infrastructure
              </p>
              <p className="text-xs text-blue-700 mt-2">
                Polyhouse structures showing 92% site suitability. Focus sales efforts on high-yield vegetable farms.
              </p>
            </div>

            <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
              <p className="font-medium text-amber-900 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Growth Opportunity
              </p>
              <p className="text-xs text-amber-700 mt-2">
                50% of drafted evaluations converting to submissions. Optimize boundary mapping process for faster turnaround.
              </p>
            </div>

            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <p className="font-medium text-green-900 flex items-center gap-2">
                <Target className="h-4 w-4" />
                Premium Positioning
              </p>
              <p className="text-xs text-green-700 mt-2">
                Shade Net ROI exceeding projections by 20%. Recommend as cost-effective alternative for budget-conscious buyers.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      </>
      )}
    </div>
  )
}

export default function InsightsPage() {
  return (
    <DashboardPageGuard module="farms">
      <InsightsPageContent />
    </DashboardPageGuard>
  )
}
