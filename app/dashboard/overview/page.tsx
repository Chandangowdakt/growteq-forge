"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { TrendingUp, MapPin, CheckCircle, Clock, AlertCircle } from "lucide-react"
import { dashboardApi } from "@/lib/api"
import { formatDistanceToNow } from "date-fns"

interface SummaryData {
  activeSites: number
  draftEvaluations: number
  submitted: number
  totalLandArea: number
  evaluations: Array<{
    _id: string
    name: string
    status: string
    area: number
    updatedAt: string
  }>
  totalRevenue: number
  averageProjectCost: number
  draftCount: number
  submittedCount: number
  totalFarms: number
  monthlyRevenue: Array<{ month: string; total: number }>
}

export default function OverviewPage() {
  const [data, setData] = useState<SummaryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSummary = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const summary: any = await dashboardApi.summary()

      setData({
        activeSites: summary.activeSites ?? 0,
        draftEvaluations: summary.draftEvaluations ?? 0,
        submitted: summary.submitted ?? 0,
        totalLandArea: summary.totalLandArea ?? 0,

        evaluations: (summary.evaluations ?? []).map((e: any) => ({
          _id: e._id,
          name: e.name,
          status: e.status,
          area: e.area ?? 0,
          updatedAt: e.updatedAt,
        })),

        totalRevenue: summary.totalRevenue ?? 0,
        averageProjectCost: summary.averageProjectCost ?? 0,
        draftCount: summary.draftCount ?? summary.draftEvaluations ?? 0,
        submittedCount: summary.submittedCount ?? summary.submitted ?? 0,
        totalFarms: summary.totalFarms ?? (summary.farms ? summary.farms.length : 0),
        monthlyRevenue: summary.monthlyRevenue ?? [],
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load dashboard")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSummary()
  }, [fetchSummary])

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-8">
        <p>Loading dashboard...</p>
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
    activeSites,
    totalLandArea,
    evaluations,
    totalRevenue,
    averageProjectCost,
    draftCount,
    submittedCount,
    monthlyRevenue,
  } = data

  const activeSitesList = evaluations.slice(0, 10).map((e) => ({
    name: e.name,
    status: e.status,
    area: e.area,
    marked: formatDistanceToNow(new Date(e.updatedAt), { addSuffix: true }),
  }))

  const sitesSalesData =
    monthlyRevenue.length > 0
      ? monthlyRevenue.map((m) => ({
          month: m.month,
          revenue: m.total,
        }))
      : []

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
      <h1 className="text-3xl font-bold mb-2">Overview</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="p-6">
            <CardDescription className="text-xs uppercase tracking-wide text-muted-foreground">
              Active Sites
            </CardDescription>
            <CardTitle className="text-2xl font-semibold">{activeSites}</CardTitle>
          </CardHeader>
        </Card>

        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="p-6">
            <CardDescription className="text-xs uppercase tracking-wide text-muted-foreground">
              Draft Evaluations
            </CardDescription>
            <CardTitle className="text-2xl font-semibold">{draftCount}</CardTitle>
          </CardHeader>
        </Card>

        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="p-6">
            <CardDescription className="text-xs uppercase tracking-wide text-muted-foreground">
              Submitted
            </CardDescription>
            <CardTitle className="text-2xl font-semibold">{submittedCount}</CardTitle>
          </CardHeader>
        </Card>

        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="p-6">
            <CardDescription className="text-xs uppercase tracking-wide text-muted-foreground">
              Total Land Area
            </CardDescription>
            <CardTitle className="text-2xl font-semibold">
              {Math.round(totalLandArea * 100) / 100} acres
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="p-6">
            <CardDescription className="text-xs uppercase tracking-wide text-muted-foreground">
              Total Revenue
            </CardDescription>
            <CardTitle className="text-2xl font-semibold">
              ₹{totalRevenue.toLocaleString("en-IN")}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="p-6">
            <CardDescription className="text-xs uppercase tracking-wide text-muted-foreground">
              Average Project Cost
            </CardDescription>
            <CardTitle className="text-2xl font-semibold">
              ₹{averageProjectCost.toLocaleString("en-IN")}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl font-semibold">Revenue Trend</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sitesSalesData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="revenue" fill="#22c55e" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl font-semibold">Current Work Sites</CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-3">
          {activeSitesList.length === 0 ? (
            <p className="text-sm text-muted-foreground">No site evaluations yet.</p>
          ) : (
            activeSitesList.map((site, idx) => (
              <div
                key={idx}
                className="flex justify-between items-center rounded-xl border px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium">{site.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {site.area} acres • {site.marked}
                  </p>
                </div>
                <span className="text-xs font-medium px-2 py-1 rounded-full bg-muted">
                  {site.status}
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}