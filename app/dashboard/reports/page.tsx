"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileText, Download, MapPin, Inbox } from "lucide-react"
import {
  api,
  reportsApi,
  siteEvaluationsApi,
  type ReportTypeItem,
  type ReportFileRow,
  type SiteEvaluation,
  ApiError,
} from "@/lib/api"
import { Skeleton } from "@/components/ui/skeleton"
import { hasPermission } from "@/lib/permissions"
import { useAuth } from "@/app/context/auth-context"
import { toast } from "@/hooks/use-toast"
import { DashboardPageGuard } from "@/components/dashboard/dashboard-page-guard"

const REPORT_TYPE_LABELS: Record<string, string> = {
  site_evaluation: "Site Evaluation Report",
  infrastructure_proposal: "Infrastructure Proposal",
  cost_estimate: "Cost Estimate Summary",
  sales_pipeline: "Sales Pipeline Report",
  site_comparison: "Site Comparison Matrix",
  executive_summary: "Executive Summary",
  unknown: "Other",
}

function ReportsPageContent() {
  const { user } = useAuth()
  const [list, setList] = useState<ReportTypeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState<string | null>(null)
  const [downloading, setDownloading] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fileHistory, setFileHistory] = useState<ReportFileRow[]>([])
  const [filesLoading, setFilesLoading] = useState(true)
  const [quickBusy, setQuickBusy] = useState<"single" | "multi" | "map" | "csv" | null>(null)

  const canGenerate = hasPermission(user, "canGenerateReports")

  const siteIdFromEvaluation = (ev: SiteEvaluation): string | null => {
    const s = ev.siteId
    if (!s) return null
    if (typeof s === "string") return s
    if (typeof s === "object" && s !== null && "_id" in s) {
      const id = (s as { _id?: string })._id
      return typeof id === "string" ? id : null
    }
    return null
  }

  const downloadBlobFile = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const parseBlobErrorMessage = async (data: Blob): Promise<string> => {
    try {
      const t = await data.text()
      const j = JSON.parse(t) as { error?: string; message?: string }
      return j.error || j.message || "Request failed"
    } catch {
      return "Request failed"
    }
  }

  const handleQuickSingleSite = async () => {
    setQuickBusy("single")
    try {
      const listRes = await siteEvaluationsApi.list()
      const evals = listRes.success && Array.isArray(listRes.data) ? listRes.data : []
      const siteId = evals.map(siteIdFromEvaluation).find((id): id is string => id != null)
      if (!siteId) {
        toast({
          title: "No evaluation found",
          description: "Create and complete a site evaluation first.",
          variant: "destructive",
        })
        return
      }
      const res = await api.get(`/api/reports/site-evaluation/${encodeURIComponent(siteId)}`, {
        responseType: "blob",
      })
      const blob = res.data as Blob
      const ct = (res.headers["content-type"] || "").toLowerCase()
      if (!ct.includes("application/pdf")) {
        throw new Error(await parseBlobErrorMessage(blob))
      }
      downloadBlobFile(blob, "single-site-evaluation.pdf")
      toast({ title: "Download started", description: "Site evaluation PDF" })
    } catch (e) {
      let description = "Could not generate the report. Try again after completing an evaluation."
      if (e instanceof ApiError && e.statusCode === 404 && e.data instanceof Blob) {
        try {
          description = await parseBlobErrorMessage(e.data)
        } catch {
          description = "No evaluation found for this site."
        }
      } else if (e instanceof Error && e.message) {
        description = e.message
      }
      toast({ title: "Single-site report failed", description, variant: "destructive" })
    } finally {
      setQuickBusy(null)
    }
  }

  const handleQuickMultiSite = async () => {
    setQuickBusy("multi")
    try {
      const listRes = await siteEvaluationsApi.list()
      const evals = listRes.success && Array.isArray(listRes.data) ? listRes.data : []
      const seen = new Set<string>()
      const siteIds: string[] = []
      for (const ev of evals) {
        const sid = siteIdFromEvaluation(ev)
        if (sid && !seen.has(sid)) {
          seen.add(sid)
          siteIds.push(sid)
          if (siteIds.length >= 40) break
        }
      }
      if (siteIds.length === 0) {
        toast({
          title: "No sites to include",
          description: "Add evaluations for at least one site first.",
          variant: "destructive",
        })
        return
      }
      const blob = await reportsApi.downloadMultiSitePdf(siteIds)
      if ((blob.type || "").toLowerCase().includes("json")) {
        throw new Error(await parseBlobErrorMessage(blob))
      }
      downloadBlobFile(blob, "multi-site-evaluation-summary.pdf")
      toast({ title: "Download started", description: "Multi-site summary PDF" })
    } catch (e) {
      let description = "Could not generate the multi-site report."
      if (e instanceof ApiError && e.data instanceof Blob) {
        description = await parseBlobErrorMessage(e.data)
      } else if (e instanceof Error && e.message) {
        description = e.message
      }
      toast({ title: "Multi-site report failed", description, variant: "destructive" })
    } finally {
      setQuickBusy(null)
    }
  }

  const handleQuickExportMap = async () => {
    setQuickBusy("map")
    try {
      const res = await reportsApi.exportMapData()
      if (!res.success || !Array.isArray(res.data)) {
        throw new Error("Invalid response from server")
      }
      const blob = new Blob([JSON.stringify({ success: true, data: res.data }, null, 2)], {
        type: "application/json",
      })
      downloadBlobFile(blob, "growteq-map-sites-export.json")
      toast({
        title: "Download started",
        description: `${res.data.length} site(s) with boundaries exported`,
      })
    } catch (e) {
      toast({
        title: "Map export failed",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      })
    } finally {
      setQuickBusy(null)
    }
  }

  const handleQuickDataTable = async () => {
    setQuickBusy("csv")
    try {
      const blob = await reportsApi.downloadEvaluationsCsv()
      const ct = (blob.type || "").toLowerCase()
      if (ct.includes("json") || ct.includes("application/problem")) {
        throw new Error(await parseBlobErrorMessage(blob))
      }
      downloadBlobFile(blob, "growteq-evaluations-export.csv")
      toast({ title: "Download started", description: "Evaluations CSV" })
    } catch (e) {
      let description = "Export failed."
      if (e instanceof ApiError && e.data instanceof Blob) {
        description = await parseBlobErrorMessage(e.data)
      } else if (e instanceof Error && e.message) {
        description = e.message
      }
      toast({ title: "Data export failed", description, variant: "destructive" })
    } finally {
      setQuickBusy(null)
    }
  }

  const loadFileHistory = () => {
    setFilesLoading(true)
    reportsApi
      .listFiles()
      .then((res) => {
        if (res?.data && Array.isArray(res.data)) setFileHistory(res.data)
        else setFileHistory([])
      })
      .catch(() => setFileHistory([]))
      .finally(() => setFilesLoading(false))
  }

  const loadList = () => {
    setLoading(true)
    setError(null)
    reportsApi
      .list()
      .then((res) => {
        if (res?.data) setList(Array.isArray(res.data) ? res.data : [])
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load reports")
        setList([])
      })
      .finally(() => setLoading(false))
  }
  useEffect(() => {
    loadList()
    loadFileHistory()
  }, [])

  const listByType = useMemo(() => {
    const m = new Map<string, ReportTypeItem>()
    for (const item of list) {
      m.set(item.reportType, item)
    }
    return m
  }, [list])

  const downloadGenerated = async (reportType: string, format: "pdf" | "excel") => {
    const key = `${reportType}-${format}`
    setError(null)
    setGenerating(key)
    try {
      const res = await reportsApi.generate({ reportType, format })
      const downloadUrl = res?.data?.downloadUrl
      const fileName = res?.data?.fileName
      if (!downloadUrl || !fileName) {
        setError("Invalid response from server")
        toast({ title: "Report failed", description: "Invalid server response.", variant: "destructive" })
        return
      }
      const baseURL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"
      const url = baseURL + downloadUrl
      const token = typeof window !== "undefined" ? localStorage.getItem("forge_token") : null
      const fileRes = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!fileRes.ok) throw new Error("Download failed")
      const blob = await fileRes.blob()
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = objectUrl
      a.download = fileName
      a.click()
      URL.revokeObjectURL(objectUrl)
      loadList()
      loadFileHistory()
      toast({ title: "Download started", description: REPORT_TYPE_LABELS[reportType] ?? reportType })
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Generate failed"
      setError(msg)
      toast({
        title: "Failed to generate report",
        description:
          msg.toLowerCase().includes("404") || msg.toLowerCase().includes("no site")
            ? "No data available yet. Complete a site evaluation first."
            : "Please try again.",
        variant: "destructive",
      })
    } finally {
      setGenerating(null)
    }
  }

  const handleDelete = async (fileName: string) => {
    if (!confirm("Are you sure you want to delete this report?")) return
    setDeleting(fileName)
    try {
      await reportsApi.remove(fileName)
      toast({ title: "Report deleted" })
      loadFileHistory()
      loadList()
    } catch {
      toast({ title: "Delete failed", variant: "destructive" })
    } finally {
      setDeleting(null)
    }
  }

  const handleDownloadExisting = async (fileName: string, key: string) => {
    setError(null)
    setDownloading(key)
    try {
      const baseURL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"
      const url = `${baseURL}/api/reports/download/${encodeURIComponent(fileName)}`
      const token = typeof window !== "undefined" ? localStorage.getItem("forge_token") : null
      const fileRes = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!fileRes.ok) throw new Error("Download failed")
      const blob = await fileRes.blob()
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = objectUrl
      a.download = fileName
      a.click()
      URL.revokeObjectURL(objectUrl)
      toast({ title: "Download started" })
      loadFileHistory()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed")
      toast({ title: "Download failed", variant: "destructive" })
    } finally {
      setDownloading(null)
    }
  }

  const lastByType = list.reduce(
    (acc, item) => {
      acc[item.reportType] = item.lastGeneratedAt ?? null
      return acc
    },
    {} as Record<string, string | null>
  )

  const reportTypes = [
    "site_evaluation",
    "infrastructure_proposal",
    "cost_estimate",
    "sales_pipeline",
    "site_comparison",
    "executive_summary",
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground">
            Generate and download reports for site evaluations and proposals
          </p>
        </div>
      </div>

      {error && list.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded p-4 mb-4">
          <p className="text-yellow-800 font-medium">No reports available yet</p>
          <p className="text-yellow-600 text-sm mt-1">
            Complete a site evaluation first, then generate reports here.
          </p>
        </div>
      )}
      {error && list.length > 0 && (
        <div className="p-4 text-red-600 flex items-center gap-2">
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={loadList}>
            Retry
          </Button>
        </div>
      )}

      {loading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {reportTypes.map((rt) => (
            <Card key={rt} className="flex flex-col overflow-hidden">
              <CardHeader className="space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {reportTypes.map((reportType) => {
            const meta = listByType.get(reportType)
            return (
              <Card key={reportType} className="flex flex-col">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="h-5 w-5 text-[#387F43]" />
                    {REPORT_TYPE_LABELS[reportType] ?? reportType}
                  </CardTitle>
                  <CardDescription>{reportType.replace(/_/g, " ")}</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <div className="mb-4 flex-1">
                    <p className="text-xs text-muted-foreground">
                      Last generated: {lastByType[reportType] ?? "Never"}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button
                      size="sm"
                      className="w-full bg-[#387F43] hover:bg-[#2d6535] text-white"
                      onClick={() => downloadGenerated(reportType, "pdf")}
                      disabled={generating === `${reportType}-pdf` || !canGenerate}
                    >
                      {generating === `${reportType}-pdf` ? (
                        <span className="flex items-center justify-center gap-2">
                          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                          </svg>
                          Generating…
                        </span>
                      ) : (
                        <span className="flex items-center justify-center gap-2">
                          <Download className="h-4 w-4" />
                          Download PDF
                        </span>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="w-full"
                      onClick={() => downloadGenerated(reportType, "excel")}
                      disabled={generating === `${reportType}-excel` || !canGenerate}
                    >
                      {generating === `${reportType}-excel` ? (
                        <span className="flex items-center justify-center gap-2">
                          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                          </svg>
                          Generating…
                        </span>
                      ) : (
                        <span className="flex items-center justify-center gap-2">
                          <Download className="h-4 w-4" />
                          Download Excel
                        </span>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-[#387F43]" />
            Quick Report Generator
          </CardTitle>
          <CardDescription>Customize and generate reports on demand</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Button
              variant="outline"
              className="h-auto py-6 flex flex-col items-start justify-start bg-transparent"
              disabled={!canGenerate || quickBusy !== null}
              onClick={() => void handleQuickSingleSite()}
            >
              <span className="text-sm font-medium mb-1">
                {quickBusy === "single" ? "Generating…" : "Single Site"}
              </span>
              <span className="text-xs text-muted-foreground">Latest evaluated site PDF</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-6 flex flex-col items-start justify-start bg-transparent"
              disabled={!canGenerate || quickBusy !== null}
              onClick={() => void handleQuickMultiSite()}
            >
              <span className="text-sm font-medium mb-1">
                {quickBusy === "multi" ? "Generating…" : "Multiple Sites"}
              </span>
              <span className="text-xs text-muted-foreground">Summary PDF (up to 40 sites)</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-6 flex flex-col items-start justify-start bg-transparent"
              disabled={!canGenerate || quickBusy !== null}
              onClick={() => void handleQuickExportMap()}
            >
              <span className="text-sm font-medium mb-1">
                {quickBusy === "map" ? "Exporting…" : "Export Map"}
              </span>
              <span className="text-xs text-muted-foreground">Sites + GeoJSON as JSON file</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-6 flex flex-col items-start justify-start bg-transparent"
              disabled={!canGenerate || quickBusy !== null}
              onClick={() => void handleQuickDataTable()}
            >
              <span className="text-sm font-medium mb-1">
                {quickBusy === "csv" ? "Exporting…" : "Data Table"}
              </span>
              <span className="text-xs text-muted-foreground">Evaluations as CSV</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Report History</CardTitle>
          <CardDescription>All generated files on the server — download without regenerating</CardDescription>
        </CardHeader>
        <CardContent>
          {filesLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between gap-2 border rounded-lg p-3">
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                  <Skeleton className="h-8 w-24 shrink-0" />
                </div>
              ))}
            </div>
          ) : fileHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center rounded-xl border border-dashed border-muted-foreground/20 bg-muted/20">
              <Inbox className="h-12 w-12 text-muted-foreground/50 mb-3" />
              <p className="font-medium text-foreground">No reports generated yet</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                Generate a report from the cards above. Files will appear here with the date and a download action.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {fileHistory.map((row) => (
                <div
                  key={row.fileName}
                  className="flex flex-wrap items-center justify-between gap-2 border rounded-lg p-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate" title={row.fileName}>
                      {row.fileName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {REPORT_TYPE_LABELS[row.type] ?? row.type} ·{" "}
                      {new Date(row.createdAt).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={downloading === `file-${row.fileName}`}
                      onClick={() => handleDownloadExisting(row.fileName, `file-${row.fileName}`)}
                    >
                      <Download className="h-3 w-3 mr-1" />
                      {downloading === `file-${row.fileName}` ? "…" : "Download"}
                    </Button>
                    {canGenerate && row.fileName.toLowerCase().endsWith(".pdf") && (
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={deleting === row.fileName}
                        onClick={() => void handleDelete(row.fileName)}
                      >
                        {deleting === row.fileName ? "…" : "Delete"}
                      </Button>
                    )}
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

export default function ReportsPage() {
  return (
    <DashboardPageGuard module="reports">
      <ReportsPageContent />
    </DashboardPageGuard>
  )
}
