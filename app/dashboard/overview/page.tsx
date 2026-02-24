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
    return <div className="p-6">Loading dashboard...</div>
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="border-l-4 border-l-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
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
    <div className="space-y-6 p-6">
      <h1 className="text-3xl font-bold">Overview</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">

        <Card>
          <CardHeader>
            <CardTitle>{activeSites}</CardTitle>
            <CardDescription>Active Sites</CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{draftCount}</CardTitle>
            <CardDescription>Draft Evaluations</CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{submittedCount}</CardTitle>
            <CardDescription>Submitted</CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{Math.round(totalLandArea * 100) / 100} acres</CardTitle>
            <CardDescription>Total Land Area</CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              ₹{totalRevenue.toLocaleString("en-IN")}
            </CardTitle>
            <CardDescription>Total Revenue</CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              ₹{averageProjectCost.toLocaleString("en-IN")}
            </CardTitle>
            <CardDescription>Average Project Cost</CardDescription>
          </CardHeader>
        </Card>

      </div>

      <Card>
        <CardHeader>
          <CardTitle>Revenue Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={sitesSalesData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="revenue" fill="#22c55e" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Current Work Sites</CardTitle>
        </CardHeader>
        <CardContent>
          {activeSitesList.length === 0 ? (
            <p>No site evaluations yet.</p>
          ) : (
            activeSitesList.map((site, idx) => (
              <div key={idx} className="flex justify-between p-2 border rounded">
                <div>
                  <p>{site.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {site.area} acres • {site.marked}
                  </p>
                </div>
                <span>{site.status}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}