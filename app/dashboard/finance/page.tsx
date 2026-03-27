"use client"

import { useEffect, useState, useMemo, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import { TrendingUp, Calculator } from "lucide-react"
import { financeApi, type FinanceSummary } from "@/lib/api"
import { formatINR } from "@/lib/utils"
import { DashboardPageGuard } from "@/components/dashboard/dashboard-page-guard"
import { Skeleton } from "@/components/ui/skeleton"

const CR = 10_000_000

function formatCr(n: number): string {
  return formatINR(n)
}

const comparisonNames: Record<string, string> = {
  polyhouse: "Polyhouse",
  shade_net: "Shade Net",
  open_field: "Open Field",
}

const defaultComparison = [
  { type: "polyhouse", initialInvestmentPerAcre: "₹25-35 lakhs", roiMonths: 18, profitMargin: "35-40%" },
  { type: "shade_net", initialInvestmentPerAcre: "₹2-5 lakhs", roiMonths: 6, profitMargin: "25-30%" },
  { type: "open_field", initialInvestmentPerAcre: "₹0.5-2 lakhs", roiMonths: 3, profitMargin: "15-20%" },
]

function FinanceContent() {
  const searchParams = useSearchParams()
  const siteId = searchParams?.get("siteId") ?? undefined
  const [summary, setSummary] = useState<FinanceSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadSummary = () => {
    setLoading(true)
    setError(null)
    financeApi
      .summary(siteId ? { siteId } : undefined)
      .then((res) => res?.data && setSummary(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadSummary()
  }, [siteId])

  const chartData = useMemo(() => {
    if (!summary?.costTrends?.length) {
      return [{ month: "—", polyhouse: 0, shade_net: 0, open_field: 0 }]
    }
    return summary.costTrends.map((row) => ({
      month: row.month,
      polyhouse: row.polyhouse ?? 0,
      shade_net: row.shade_net ?? 0,
      open_field: row.open_field ?? 0,
    }))
  }, [summary])

  const comparisonRows = useMemo(() => {
    const comp = summary?.comparison?.length ? summary.comparison : defaultComparison
    return comp.map((c: { type: string; roiMonths?: number; profitMargin?: string; initialInvestmentPerAcre?: string }) => ({
      type: c.type,
      label: (c as { initialInvestmentPerAcre?: string }).initialInvestmentPerAcre ?? defaultComparison.find((d) => d.type === c.type)?.initialInvestmentPerAcre ?? "—",
      roi: `${c.roiMonths ?? 0} months`,
      margins: c.profitMargin ?? "—",
    }))
  }, [summary])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Finance</h1>
        <p className="text-muted-foreground">
          Cost estimates and ROI analysis for site infrastructure proposals
        </p>
      </div>

      {siteId && (
        <p className="text-sm text-muted-foreground">
          Filtering by site: <code>{siteId}</code>
        </p>
      )}

      {error && (
        <div className="p-4 text-red-600 flex items-center gap-2">
          <span>Failed to load data. {error}</span>
          <Button variant="outline" size="sm" onClick={loadSummary}>Retry</Button>
        </div>
      )}

      {loading ? (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardHeader className="pb-2 space-y-2">
                  <Skeleton className="h-3 w-36" />
                  <Skeleton className="h-8 w-28" />
                </CardHeader>
              </Card>
            ))}
          </div>
          <Skeleton className="h-[350px] w-full rounded-xl" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="border-l-4 border-l-[#387F43]">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs">Total Estimated Investment</CardDescription>
                <CardTitle className="text-2xl text-[#387F43]">
                  {summary != null ? formatCr(summary.totalInvestment) : "₹0"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">Across all proposals</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-green-600">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs">Expected Total ROI</CardDescription>
                <CardTitle className="text-2xl text-green-600">
                  {summary != null ? formatCr(summary.expectedROI) : "₹0"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-xs">
                  <TrendingUp className="h-3 w-3 text-green-600" />
                  <span className="text-green-600">115% return potential</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-blue-500">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs">Avg ROI Timeline</CardDescription>
                <CardTitle className="text-2xl text-blue-600">
                  {summary?.avgROITimeline != null ? `${summary.avgROITimeline} months` : "—"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">Weighted average</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-purple-600">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs">Active Proposals</CardDescription>
                <CardTitle className="text-2xl text-purple-600">
                  {summary?.activeProposals ?? 0}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">Non-rejected</p>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="proposals">Proposals</TabsTrigger>
              <TabsTrigger value="comparison">Comparison</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-[#387F43]">Cost Trends by Infrastructure Type</CardTitle>
                  <CardDescription>Estimated monthly proposal values (₹ Cr)</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={350}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis tickFormatter={(v) => formatINR(v)} />
                      <Tooltip formatter={(value: number) => formatINR(value)} />
                      <Legend />
                      <Line type="monotone" dataKey="polyhouse" stroke="#15803d" strokeWidth={2} name="Polyhouse" />
                      <Line type="monotone" dataKey="shade_net" stroke="#f59e0b" strokeWidth={2} name="Shade Net" />
                      <Line type="monotone" dataKey="open_field" stroke="#06b6d4" strokeWidth={2} name="Open Field" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calculator className="h-5 w-5 text-[#387F43]" />
                    Infrastructure Cost Comparison
                  </CardTitle>
                  <CardDescription>Per-acre investment and returns</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Initial Investment</TableHead>
                        <TableHead>ROI Timeline</TableHead>
                        <TableHead>Profit Margins</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {comparisonRows.map((row) => (
                        <TableRow key={row.type}>
                          <TableCell className="font-medium">{comparisonNames[row.type] ?? row.type}</TableCell>
                          <TableCell>{row.label}</TableCell>
                          <TableCell className="text-blue-600">{row.roi}</TableCell>
                          <TableCell className="text-green-600">{row.margins}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="proposals" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Proposals</CardTitle>
                  <CardDescription>Use Reports for detailed proposal list</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">Active proposals count: {summary?.activeProposals ?? 0}</p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="comparison" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-[#387F43]">Infrastructure Cost Comparison</CardTitle>
                  <CardDescription>ROI timeline and profit margins by type</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Initial Investment</TableHead>
                        <TableHead>ROI Timeline</TableHead>
                        <TableHead>Profit Margins</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {comparisonRows.map((row) => (
                        <TableRow key={row.type}>
                          <TableCell className="font-medium">{comparisonNames[row.type] ?? row.type}</TableCell>
                          <TableCell>{row.label}</TableCell>
                          <TableCell className="text-blue-600">{row.roi}</TableCell>
                          <TableCell className="text-green-600">{row.margins}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  )
}

export default function FinancePage() {
  return (
    <DashboardPageGuard module="finance">
      <Suspense
        fallback={
          <div className="space-y-6 p-6">
            <Skeleton className="h-9 w-40" />
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i}>
                  <CardHeader className="pb-2 space-y-2">
                    <Skeleton className="h-3 w-32" />
                    <Skeleton className="h-8 w-24" />
                  </CardHeader>
                </Card>
              ))}
            </div>
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        }
      >
        <FinanceContent />
      </Suspense>
    </DashboardPageGuard>
  )
}
