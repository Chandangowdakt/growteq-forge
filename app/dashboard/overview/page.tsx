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
  evaluations: Array<{ _id: string; name: string; status: string; area: number; updatedAt: string }>
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
      const summary = await dashboardApi.summary()
      setData({
        activeSites: summary.activeSites,
        draftEvaluations: summary.draftEvaluations,
        submitted: summary.submitted,
        totalLandArea: summary.totalLandArea,
        evaluations: summary.evaluations.map((e) => ({
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
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
          <p className="text-muted-foreground">Sales pipeline overview - site evaluations and infrastructure planning</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="border-l-4 border-l-[#387F43]">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs">—</CardDescription>
                <CardTitle className="text-2xl text-[#387F43]">—</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">Loading…</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">Loading dashboard…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
          <p className="text-muted-foreground">Sales pipeline overview - site evaluations and infrastructure planning</p>
        </div>
        <Card className="border-l-4 border-l-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Error loading dashboard
            </CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={fetchSummary} variant="outline">Try again</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!data) {
    return null
  }

  const {
    activeSites,
    draftEvaluations,
    submitted,
    totalLandArea,
    evaluations,
    totalRevenue,
    averageProjectCost,
    draftCount,
    submittedCount,
    totalFarms,
    monthlyRevenue,
  } = data
  const activeSitesList = evaluations.slice(0, 10).map((e) => ({
    name: e.name,
    status: e.status,
    area: e.area,
    marked: formatDistanceToNow(new Date(e.updatedAt), { addSuffix: true }),
  }))

  const sitesSalesData =
    monthlyRevenue && monthlyRevenue.length > 0
      ? monthlyRevenue.map((m) => ({
          month: m.month,
          revenue: m.total,
        }))
      : []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
        <p className="text-muted-foreground">Sales pipeline overview - site evaluations and infrastructure planning</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-[#387F43]">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Active Sites</CardDescription>
            <CardTitle className="text-2xl text-[#387F43]">{activeSites}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Being evaluated</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Draft Evaluations</CardDescription>
            <CardTitle className="text-2xl text-orange-600">{draftCount}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Boundaries pending</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-600">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Submitted</CardDescription>
            <CardTitle className="text-2xl text-green-600">{submittedCount}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-xs">
              <TrendingUp className="h-3 w-3 text-green-600" />
              <span className="text-green-600">Submitted</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Total Land Area</CardDescription>
            <CardTitle className="text-2xl text-blue-500">{Math.round(totalLandArea * 100) / 100} acres</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Across all sites</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Total Revenue</CardDescription>
            <CardTitle className="text-2xl text-emerald-600">
              {totalRevenue.toLocaleString("en-IN", {
                style: "currency",
                currency: "INR",
                maximumFractionDigits: 0,
              })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">From submitted evaluations</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Average Project Cost</CardDescription>
            <CardTitle className="text-2xl text-purple-600">
              {averageProjectCost.toLocaleString("en-IN", {
                style: "currency",
                currency: "INR",
                maximumFractionDigits: 0,
              })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Per submitted evaluation</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-[#387F43]">Site Evaluation Pipeline</CardTitle>
            <CardDescription>Summary</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={sitesSalesData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="revenue" fill="#22c55e" name="Revenue" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-[#387F43]" />
              Quick Actions
            </CardTitle>
            <CardDescription>Common tasks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="w-full bg-[#387F43] hover:bg-[#2d6535]" asChild>
              <Link href="/dashboard/farms">+ Start New Site Evaluation</Link>
            </Button>
            <Button className="w-full bg-transparent" variant="outline" asChild>
              <Link href="/dashboard/farms">View Map Submissions</Link>
            </Button>
            <Button className="w-full bg-transparent" variant="outline">
              Generate Cost Estimates
            </Button>
            <Button className="w-full bg-transparent" variant="outline">
              Export Reports
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-[#387F43]" />
            Current Work Sites
          </CardTitle>
          <CardDescription>{activeSitesList.length} sites being worked on</CardDescription>
        </CardHeader>
        <CardContent>
          {activeSitesList.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No site evaluations yet. Create one from the Farms page.</p>
          ) : (
            <div className="space-y-3">
              {activeSitesList.map((site, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{site.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {site.area} acres • Last marked: {site.marked}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {site.status === "draft" ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                        <Clock className="h-3 w-3 mr-1" />
                        Draft
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Submitted
                      </span>
                    )}
                    <Button size="sm" variant="outline" asChild>
                      <Link href="/dashboard/farms">Open</Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
