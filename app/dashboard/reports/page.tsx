"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileText, Download, MapPin } from "lucide-react"
import { reportsApi, type ReportTypeItem } from "@/lib/api"
import { hasPermission } from "@/lib/permissions"
import { useAuth } from "@/app/context/auth-context"

const REPORT_TYPE_LABELS: Record<string, string> = {
  site_evaluation: "Site Evaluation Report",
  infrastructure_proposal: "Infrastructure Proposal",
  cost_estimate: "Cost Estimate Summary",
  sales_pipeline: "Sales Pipeline Report",
  site_comparison: "Site Comparison Matrix",
  executive_summary: "Executive Summary",
}

export default function ReportsPage() {
  const { user } = useAuth()
  const [list, setList] = useState<ReportTypeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState<string | null>(null)
  const [downloading, setDownloading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const canGenerate = hasPermission(user, "canGenerateReports")

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
  }, [])

  const listByType = useMemo(() => {
    const m = new Map<string, ReportTypeItem>()
    for (const item of list) {
      m.set(item.reportType, item)
    }
    return m
  }, [list])

  const handleGenerate = async (reportType: string, format: "pdf" | "excel") => {
    setError(null)
    try {
      const res = await reportsApi.generate({ reportType, format })
      const downloadUrl = res?.data?.downloadUrl
      const fileName = res?.data?.fileName
      if (!downloadUrl || !fileName) {
        setError("Invalid response from server")
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generate failed")
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed")
    } finally {
      setDownloading(null)
    }
  }

  const lastByType = list.reduce((acc, item) => {
    acc[item.reportType] = item.lastGeneratedAt ?? null
    return acc
  }, {} as Record<string, string | null>)

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
        <div className="p-8 animate-pulse text-muted-foreground">Loading…</div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {reportTypes.map((reportType) => {
            const meta = listByType.get(reportType)
            const pdfFile = meta?.pdfFileName ?? null
            const excelFile = meta?.excelFileName ?? null
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
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase text-muted-foreground font-medium">PDF</p>
                      <Button
                        size="sm"
                        className="w-full bg-[#387F43] hover:bg-[#2d6535]"
                        onClick={async () => {
                          setGenerating(`${reportType}-pdf`)
                          try {
                            await handleGenerate(reportType, "pdf")
                          } finally {
                            setGenerating(null)
                          }
                        }}
                        disabled={generating === `${reportType}-pdf` || !canGenerate}
                      >
                        {generating === `${reportType}-pdf` ? "…" : "Generate"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        onClick={() => pdfFile && handleDownloadExisting(pdfFile, `${reportType}-pdf-dl`)}
                        disabled={!pdfFile || downloading === `${reportType}-pdf-dl`}
                      >
                        <Download className="h-3 w-3 mr-1" />
                        {downloading === `${reportType}-pdf-dl` ? "…" : "Download"}
                      </Button>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase text-muted-foreground font-medium">Excel</p>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="w-full"
                        onClick={async () => {
                          setGenerating(`${reportType}-xlsx`)
                          try {
                            await handleGenerate(reportType, "excel")
                          } finally {
                            setGenerating(null)
                          }
                        }}
                        disabled={generating === `${reportType}-xlsx` || !canGenerate}
                      >
                        {generating === `${reportType}-xlsx` ? "…" : "Generate"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        onClick={() =>
                          excelFile && handleDownloadExisting(excelFile, `${reportType}-excel-dl`)
                        }
                        disabled={!excelFile || downloading === `${reportType}-excel-dl`}
                      >
                        <Download className="h-3 w-3 mr-1" />
                        {downloading === `${reportType}-excel-dl` ? "…" : "Download"}
                      </Button>
                    </div>
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
              disabled={!canGenerate}
            >
              <span className="text-sm font-medium mb-1">Single Site</span>
              <span className="text-xs text-muted-foreground">Generate for one site</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-6 flex flex-col items-start justify-start bg-transparent"
              disabled={!canGenerate}
            >
              <span className="text-sm font-medium mb-1">Multiple Sites</span>
              <span className="text-xs text-muted-foreground">Compare all evaluations</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-6 flex flex-col items-start justify-start bg-transparent"
              disabled={!canGenerate}
            >
              <span className="text-sm font-medium mb-1">Export Map</span>
              <span className="text-xs text-muted-foreground">Map with boundaries</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-6 flex flex-col items-start justify-start bg-transparent"
              disabled={!canGenerate}
            >
              <span className="text-sm font-medium mb-1">Data Table</span>
              <span className="text-xs text-muted-foreground">Raw data in Excel</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
