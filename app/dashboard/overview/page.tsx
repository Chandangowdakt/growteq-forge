"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { TrendingUp, MapPin, CheckCircle, Clock, AlertCircle } from "lucide-react"
import { dashboardApi } from "@/lib/api"
import { formatINR } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"

interface SummaryData {
  totalSites: number
  totalArea: number
  totalProposals: number
  pipelineValue: number
  averageROI: number
  revenueTrend: { month: string; value: number }[]
}

export default function OverviewPage() {
  const [data, setData] = useState<SummaryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

      const { data: summary } = await dashboardApi.summary()

      setData({
        totalSites: summary.totalSites ?? 0,
        totalArea: summary.totalArea ?? 0,
        totalProposals: summary.totalProposals ?? 0,
        pipelineValue: summary.pipelineValue ?? 0,
        averageROI: summary.averageROI ?? 0,
        revenueTrend: Array.isArray(summary.revenueTrend) ? summary.revenueTrend : [],
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
              {Math.round(totalArea * 100) / 100}
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
              {averageROI.toLocaleString("en-IN", { maximumFractionDigits: 1 })}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="p-6">
            <CardDescription className="text-xs uppercase tracking-wide text-muted-foreground">
              Proposals in Pipeline
            </CardDescription>
            <CardTitle className="text-2xl font-semibold">
              {totalProposals}
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