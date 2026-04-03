"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { MapPin, Zap, FileText } from "lucide-react"
import { dashboardApi, type WorkInProgressItem } from "@/lib/api"
import { DashboardPageGuard } from "@/components/dashboard/dashboard-page-guard"

function timeAgo(date: string): string {
  const d = new Date(date)
  const now = new Date()
  const sec = Math.floor((now.getTime() - d.getTime()) / 1000)
  if (sec < 60) return "Just now"
  if (sec < 3600) return `${Math.floor(sec / 60)} min ago`
  if (sec < 86400) return `${Math.floor(sec / 3600)} hours ago`
  if (sec < 2592000) return `${Math.floor(sec / 86400)} days ago`
  return `${Math.floor(sec / 2592000)} months ago`
}

const infrastructureOptions = [
  { type: "Polyhouse", suitability: "High", icon: "🏠", description: "Controlled climate farming" },
  { type: "Shade Net", suitability: "Medium", icon: "🌐", description: "Sun protection structure" },
  { type: "Open Field", suitability: "High", icon: "🌾", description: "Traditional cultivation" },
]

function DashboardWorkContent() {
  const [work, setWork] = useState<WorkInProgressItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadWork = () => {
    setLoading(true)
    setError(null)
    dashboardApi
      .workInProgress()
      .then((res) => {
        if (res?.data) setWork(Array.isArray(res.data) ? res.data : [])
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false))
  }
  useEffect(() => {
    loadWork()
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Work-in-progress: Current site evaluations and next steps
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Button asChild className="h-auto py-4 px-6 bg-[#387F43] hover:bg-[#2d6535] flex flex-col items-start justify-start">
          <Link href="/dashboard/farms">
            <span className="text-xs font-medium opacity-90">Quick Start</span>
            <span className="text-base font-bold block">+ Evaluate Site</span>
          </Link>
        </Button>
        <Button asChild className="h-auto py-4 px-6 bg-blue-600 hover:bg-blue-700 flex flex-col items-start justify-start">
          <Link href="/dashboard/farms">
            <span className="text-xs font-medium opacity-90">Current Work</span>
            <span className="text-base font-bold block">View Map</span>
          </Link>
        </Button>
        <Button asChild className="h-auto py-4 px-6 bg-orange-600 hover:bg-orange-700 flex flex-col items-start justify-start">
          <Link href="/dashboard/finance">
            <span className="text-xs font-medium opacity-90">Pending</span>
            <span className="text-base font-bold block">Estimate Cost</span>
          </Link>
        </Button>
        <Button asChild className="h-auto py-4 px-6 bg-purple-600 hover:bg-purple-700 flex flex-col items-start justify-start">
          <Link href="/dashboard/reports">
            <span className="text-xs font-medium opacity-90">Export</span>
            <span className="text-base font-bold block">Generate Proposal</span>
          </Link>
        </Button>
      </div>

      {error && (
        <div className="p-4 text-red-600 flex items-center gap-2">
          <span>Failed to load data. {error}</span>
          <Button variant="outline" size="sm" onClick={loadWork}>Retry</Button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-[#387F43]" />
                Current Site Work
              </CardTitle>
              <CardDescription>Sites being evaluated now</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <p className="text-sm text-muted-foreground animate-pulse">Loading…</p>
              ) : work.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No sites being evaluated. Click + Evaluate Site to get started.
                </p>
              ) : (
                work.map((site) => {
                  const points = (site as { boundaryPoints?: number }).boundaryPoints ?? site.boundaryPointCount ?? 0
                  const badge =
                    site.status === "rejected"
                      ? { class: "bg-red-100 text-red-800", label: "Rejected" }
                      : site.status === "approved"
                        ? { class: "bg-green-100 text-green-800", label: "Approved" }
                        : site.status === "submitted"
                          ? { class: "bg-blue-100 text-blue-800", label: "Submitted" }
                          : { class: "bg-gray-100 text-gray-800", label: "Draft" }
                  const mapHref =
                    site.farmId && site.siteId
                      ? `/dashboard/farms/${site.farmId}/sites/${site.siteId}`
                      : "/dashboard/farms"
                  const financeHref =
                    site.siteId != null && site.siteId !== ""
                      ? `/dashboard/finance?siteId=${encodeURIComponent(site.siteId)}`
                      : "/dashboard/finance"
                  const proposalHref =
                    site.proposalId != null && site.proposalId !== ""
                      ? `/dashboard/proposals/${site.proposalId}`
                      : "/dashboard/reports"
                  return (
                  <div key={site._id} className="p-4 border rounded-lg hover:bg-gray-50">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{site.farmName}</p>
                        <p className="text-sm text-foreground mt-0.5">{site.siteName}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Updated {timeAgo(site.updatedAt)} • Boundary {points} pts
                        </p>
                      </div>
                      <span className={`shrink-0 px-2 py-1 rounded-full text-xs font-medium capitalize ${badge.class}`}>
                        {badge.label}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-sm mb-3">
                      <div className="p-2 bg-gray-50 rounded">
                        <p className="text-xs text-muted-foreground">Area</p>
                        <p className="font-bold text-[#387F43]">{site.area} acres</p>
                      </div>
                      <div className="p-2 bg-gray-50 rounded">
                        <p className="text-xs text-muted-foreground">Boundary</p>
                        <p className="font-bold">{points} pts</p>
                      </div>
                      <div className="p-2 bg-gray-50 rounded">
                        <p className="text-xs text-muted-foreground">Completion</p>
                        <p className="font-bold text-foreground">{site.completionPercentage}%</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button asChild size="sm" variant="outline" className="w-full border-[#387F43] text-[#387F43] hover:bg-green-50">
                        <Link href={`/dashboard/site-evaluations/${site._id}`}>Evaluate Site</Link>
                      </Button>
                      <Button asChild size="sm" variant="outline" className="w-full border-blue-600 text-blue-700 hover:bg-blue-50">
                        <Link href={mapHref}>View Map</Link>
                      </Button>
                      <Button asChild size="sm" variant="outline" className="w-full border-orange-600 text-orange-700 hover:bg-orange-50">
                        <Link href={financeHref}>Estimate Cost</Link>
                      </Button>
                      <Button asChild size="sm" variant="outline" className="w-full border-purple-600 text-purple-700 hover:bg-purple-50">
                        <Link href={proposalHref}>Generate Proposal</Link>
                      </Button>
                    </div>
                  </div>
                  )
                })
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-yellow-600" />
                Infrastructure Options
              </CardTitle>
              <CardDescription>Based on site evaluation</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {infrastructureOptions.map((item, idx) => (
                <div key={idx} className="p-3 border rounded-lg hover:bg-gray-50">
                  <p className="font-medium text-sm">{item.type}</p>
                  <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                      {item.suitability}
                    </span>
                    <span className="text-lg">{item.icon}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5 text-purple-600" />
                Next Step
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm font-medium text-blue-900 mb-2">Ready to generate proposal?</p>
                <p className="text-xs text-blue-700 mb-3">
                  Complete site evaluation and cost calculations for selected site.
                </p>
                <Button asChild size="sm" className="w-full bg-[#387F43] hover:bg-[#2d6535]">
                  <Link href="/dashboard/reports">Generate Proposal</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  return (
    <DashboardPageGuard module="farms">
      <DashboardWorkContent />
    </DashboardPageGuard>
  )
}
