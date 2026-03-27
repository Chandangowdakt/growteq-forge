"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { siteEvaluationsApi, farmsApi, reportsApi, type Farm, type SiteEvaluation } from "@/lib/api"
import { formatDistanceToNow } from "date-fns"
import { toast } from "@/hooks/use-toast"
import { hasPermission, canWriteModule } from "@/lib/permissions"
import { useAuth } from "@/app/context/auth-context"
import { DashboardPageGuard } from "@/components/dashboard/dashboard-page-guard"

type EvalRow = SiteEvaluation & { proposalId?: string | null }

function idFromRef(ref: unknown): string {
  if (ref == null) return ""
  if (typeof ref === "object" && ref !== null && "_id" in ref)
    return String((ref as { _id: string })._id)
  return String(ref)
}

function farmDisplayName(ev: EvalRow): string {
  const f = ev.farmId
  if (f && typeof f === "object" && "name" in f && (f as { name?: string }).name)
    return String((f as { name: string }).name)
  return "Unknown Farm"
}

function siteDisplayName(ev: EvalRow): string {
  const s = ev.siteId
  if (s && typeof s === "object" && "name" in s && (s as { name?: string }).name)
    return String((s as { name: string }).name)
  if (ev.name?.trim()) return ev.name
  return "Unknown Site"
}

function siteIdString(ev: EvalRow): string | null {
  const s = ev.siteId
  if (!s) return null
  if (typeof s === "object" && "_id" in s && (s as { _id?: string })._id)
    return String((s as { _id: string })._id)
  if (typeof s === "string") return s
  return null
}

function statusBadgeClass(status: string) {
  const map: Record<string, string> = {
    draft: "bg-gray-100 text-gray-800 border-gray-200",
    submitted: "bg-blue-100 text-blue-800 border-blue-200",
    approved: "bg-green-100 text-green-800 border-green-200",
    rejected: "bg-red-100 text-red-800 border-red-200",
  }
  return map[status] ?? "bg-gray-100 text-gray-800 border-gray-200"
}

function SiteEvaluationsPageContent() {
  const { user } = useAuth()
  const router = useRouter()
  const [evaluations, setEvaluations] = useState<EvalRow[]>([])
  const [farms, setFarms] = useState<Farm[]>([])
  const [sites, setSites] = useState<{ _id: string; name: string; area: number }[]>([])
  const [sitesLoading, setSitesLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    siteId: "",
    farmId: "",
    soilType: "",
    waterAvailability: "",
    slopePercentage: "",
    elevationMeters: "",
    sunExposure: "full" as "full" | "partial" | "shade",
    notes: "",
  })

  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [farmFilter, setFarmFilter] = useState<string>("all")
  const [searchSite, setSearchSite] = useState("")
  const [deleteTarget, setDeleteTarget] = useState<EvalRow | null>(null)
  const [deleteSubmitting, setDeleteSubmitting] = useState(false)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  const fetchEvaluations = useCallback(async () => {
    setLoading(true)
    try {
      const res = await siteEvaluationsApi.list()
      if (res.success && res.data) {
        const sorted = [...(res.data as EvalRow[])].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        setEvaluations(sorted)
      }
    } catch {
      setEvaluations([])
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchFarms = useCallback(async () => {
    try {
      const res = await farmsApi.list()
      if (res.success && res.data) setFarms(res.data)
    } catch {
      setFarms([])
    }
  }, [])

  useEffect(() => {
    fetchEvaluations()
    fetchFarms()
  }, [fetchEvaluations, fetchFarms])

  useEffect(() => {
    if (formOpen) fetchFarms()
  }, [formOpen, fetchFarms])

  const fetchSitesForFarm = useCallback(async (farmId: string) => {
    if (!farmId) {
      setSites([])
      return
    }
    setSitesLoading(true)
    try {
      const res = await farmsApi.getSites(farmId)
      if (res.success && res.data) setSites(res.data)
      else setSites([])
    } catch {
      setSites([])
    } finally {
      setSitesLoading(false)
    }
  }, [])

  useEffect(() => {
    if (form.farmId) fetchSitesForFarm(form.farmId)
    else setSites([])
  }, [form.farmId, fetchSitesForFarm])

  const farmFilterOptions = useMemo(() => {
    const m = new Map<string, string>()
    for (const ev of evaluations) {
      const id = idFromRef(ev.farmId)
      if (!id) continue
      m.set(id, farmDisplayName(ev))
    }
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [evaluations])

  const filteredEvaluations = useMemo(() => {
    let rows = [...evaluations]
    if (statusFilter !== "all") rows = rows.filter((e) => e.status === statusFilter)
    if (farmFilter !== "all") rows = rows.filter((e) => idFromRef(e.farmId) === farmFilter)
    if (searchSite.trim()) {
      const q = searchSite.trim().toLowerCase()
      rows = rows.filter((e) => siteDisplayName(e).toLowerCase().includes(q))
    }
    return rows
  }, [evaluations, statusFilter, farmFilter, searchSite])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.siteId || !form.farmId || !form.soilType.trim() || !form.waterAvailability.trim() || !form.slopePercentage) {
      toast({ title: "Missing required fields", variant: "destructive" })
      return
    }
    setSubmitting(true)
    try {
      const res = await siteEvaluationsApi.create({
        siteId: form.siteId,
        farmId: form.farmId,
        soilType: form.soilType.trim(),
        waterAvailability: form.waterAvailability.trim(),
        slopePercentage: Number(form.slopePercentage),
        elevationMeters: form.elevationMeters ? Number(form.elevationMeters) : undefined,
        sunExposure: form.sunExposure,
        notes: form.notes.trim() || undefined,
      })
      if (res.success && res.data) {
        const { proposal } = res.data as {
          proposal?: { infrastructureType?: string; investmentValue?: number; roiMonths?: number }
        }
        const infra = proposal?.infrastructureType ?? "—"
        const inv = proposal?.investmentValue
        const roi = proposal?.roiMonths
        toast({
          title: "Evaluation created",
          description: `Recommended: ${infra} | Investment: ${inv != null ? `₹${Number(inv).toLocaleString("en-IN")}` : "—"} | ROI: ${roi != null ? `${roi} months` : "—"}`,
        })
        setForm({
          siteId: "",
          farmId: "",
          soilType: "",
          waterAvailability: "",
          slopePercentage: "",
          elevationMeters: "",
          sunExposure: "full",
          notes: "",
        })
        setFormOpen(false)
        fetchEvaluations()
      }
    } catch {
      toast({ title: "Failed to create evaluation", variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDownloadPdf = async (ev: EvalRow) => {
    const sid = siteIdString(ev)
    if (!sid) {
      toast({ title: "Cannot download", description: "Site not linked to this evaluation.", variant: "destructive" })
      return
    }
    if (!hasPermission(user, "canGenerateReports")) {
      toast({ title: "No permission", variant: "destructive" })
      return
    }
    setDownloadingId(ev._id)
    try {
      const res = await reportsApi.generate({
        reportType: "site_evaluation",
        format: "pdf",
        siteIds: [sid],
      })
      const downloadUrl = res?.data?.downloadUrl
      const fileName = res?.data?.fileName
      if (!downloadUrl || !fileName) throw new Error("Invalid response")
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"
      const t = localStorage.getItem("forge_token")
      const fileRes = await fetch(apiUrl + downloadUrl, {
        headers: t ? { Authorization: `Bearer ${t}` } : {},
      })
      if (!fileRes.ok) throw new Error("Download failed")
      const blob = await fileRes.blob()
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = objectUrl
      a.download = fileName
      a.click()
      URL.revokeObjectURL(objectUrl)
      toast({ title: "Download started", description: "Site evaluation PDF" })
    } catch {
      toast({ title: "Download failed", variant: "destructive" })
    } finally {
      setDownloadingId(null)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    setDeleteSubmitting(true)
    try {
      await siteEvaluationsApi.delete(deleteTarget._id)
      toast({ title: "Evaluation deleted" })
      setDeleteTarget(null)
      fetchEvaluations()
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" })
    } finally {
      setDeleteSubmitting(false)
    }
  }

  const canNew = hasPermission(user, "canGenerateProposal")
  const canDelete = canWriteModule(user, "evaluations")

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Site Evaluations</h1>
          <p className="text-muted-foreground">Infrastructure suitability and proposals</p>
        </div>
        {canNew && (
          <Button className="bg-[#387F43] hover:bg-[#2d6535] w-full sm:w-auto" onClick={() => setFormOpen(true)}>
            New Evaluation
          </Button>
        )}
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New evaluation</DialogTitle>
            <DialogDescription>Create a site evaluation. A recommendation proposal will be generated.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Farm</Label>
                <Select
                  value={form.farmId}
                  onValueChange={(v) => setForm((f) => ({ ...f, farmId: v, siteId: "" }))}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select farm" />
                  </SelectTrigger>
                  <SelectContent>
                    {farms.map((f) => (
                      <SelectItem key={f._id} value={f._id}>
                        {f.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Site</Label>
                <Select
                  value={form.siteId}
                  onValueChange={(v) => setForm((f) => ({ ...f, siteId: v }))}
                  required
                  disabled={!form.farmId || sitesLoading}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={form.farmId && sitesLoading ? "Loading sites..." : "Select site"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {sites.map((s) => (
                      <SelectItem key={s._id} value={s._id}>
                        {s.name} ({s.area} ac)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="soil">Soil type</Label>
                <Input
                  id="soil"
                  value={form.soilType}
                  onChange={(e) => setForm((f) => ({ ...f, soilType: e.target.value }))}
                  placeholder="e.g. Loam"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="water">Water availability</Label>
                <Input
                  id="water"
                  value={form.waterAvailability}
                  onChange={(e) => setForm((f) => ({ ...f, waterAvailability: e.target.value }))}
                  placeholder="e.g. Borewell"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="slope">Slope %</Label>
                <Input
                  id="slope"
                  type="number"
                  min={0}
                  max={100}
                  value={form.slopePercentage}
                  onChange={(e) => setForm((f) => ({ ...f, slopePercentage: e.target.value }))}
                  placeholder="0"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label>Sun exposure</Label>
                <Select
                  value={form.sunExposure}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, sunExposure: v as "full" | "partial" | "shade" }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full">Full</SelectItem>
                    <SelectItem value="partial">Partial</SelectItem>
                    <SelectItem value="shade">Shade</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="notes">Notes (optional)</Label>
                <Input
                  id="notes"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Notes"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" className="bg-[#387F43] hover:bg-[#2d6535]" disabled={submitting}>
                {submitting ? "Creating…" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete evaluation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the evaluation for{" "}
              <span className="font-medium text-foreground">{deleteTarget ? siteDisplayName(deleteTarget) : ""}</span>.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteSubmitting}
              onClick={(e) => {
                e.preventDefault()
                void handleDeleteConfirm()
              }}
            >
              {deleteSubmitting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card>
        <CardHeader>
          <CardTitle>Evaluations</CardTitle>
          <CardDescription>
            {loading
              ? "Loading…"
              : `${filteredEvaluations.length} shown${evaluations.length !== filteredEvaluations.length ? ` of ${evaluations.length}` : ""}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!loading && evaluations.length > 0 && (
            <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
              <div className="grid gap-2 min-w-[140px] flex-1">
                <Label className="text-xs text-muted-foreground">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="submitted">Submitted</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2 min-w-[160px] flex-1">
                <Label className="text-xs text-muted-foreground">Farm</Label>
                <Select value={farmFilter} onValueChange={setFarmFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All farms" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All farms</SelectItem>
                    {farmFilterOptions.map(([id, name]) => (
                      <SelectItem key={id} value={id}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2 flex-[2] min-w-[200px]">
                <Label className="text-xs text-muted-foreground">Search site</Label>
                <Input
                  placeholder="Filter by site name…"
                  value={searchSite}
                  onChange={(e) => setSearchSite(e.target.value)}
                />
              </div>
            </div>
          )}

          {loading ? (
            <p className="text-sm text-muted-foreground animate-pulse">Loading...</p>
          ) : evaluations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 px-4 text-center rounded-lg border border-dashed border-muted-foreground/20 bg-muted/20">
              <p className="font-medium text-foreground">No evaluations yet</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                Create an evaluation to capture soil, water, and infrastructure fit for a site.
              </p>
              {canNew && (
                <Button className="mt-6 bg-[#387F43] hover:bg-[#2d6535]" onClick={() => setFormOpen(true)}>
                  New Evaluation
                </Button>
              )}
            </div>
          ) : filteredEvaluations.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No evaluations match your filters.{" "}
              <button
                type="button"
                className="text-[#387F43] underline underline-offset-2"
                onClick={() => {
                  setStatusFilter("all")
                  setFarmFilter("all")
                  setSearchSite("")
                }}
              >
                Clear filters
              </button>
            </p>
          ) : (
            <div className="relative max-h-[min(60vh,560px)] overflow-auto rounded-md border">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_hsl(var(--border))]">
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Site</TableHead>
                    <TableHead>Farm</TableHead>
                    <TableHead>Soil</TableHead>
                    <TableHead>Water</TableHead>
                    <TableHead>Slope %</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right w-[280px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEvaluations.map((ev) => (
                    <TableRow
                      key={ev._id}
                      className="cursor-pointer hover:bg-muted/60"
                      onClick={() => router.push(`/dashboard/site-evaluations/${ev._id}`)}
                    >
                      <TableCell className="font-medium">{siteDisplayName(ev)}</TableCell>
                      <TableCell>{farmDisplayName(ev)}</TableCell>
                      <TableCell>{ev.soilType ?? "—"}</TableCell>
                      <TableCell>{ev.waterAvailability ?? "—"}</TableCell>
                      <TableCell>{ev.slopePercentage ?? "—"}</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Badge variant="outline" className={statusBadgeClass(ev.status)}>
                          {ev.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(ev.createdAt), { addSuffix: true })}
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-wrap justify-end gap-1.5">
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/dashboard/site-evaluations/${ev._id}`}>View</Link>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-[#387F43] text-[#387F43] hover:bg-green-50"
                            disabled={
                              !siteIdString(ev) || !hasPermission(user, "canGenerateReports") || downloadingId === ev._id
                            }
                            title={!siteIdString(ev) ? "No site linked" : undefined}
                            onClick={() => void handleDownloadPdf(ev)}
                          >
                            {downloadingId === ev._id ? "…" : "Download PDF"}
                          </Button>
                          {canDelete && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-red-600 border-red-200 hover:bg-red-50"
                              onClick={() => setDeleteTarget(ev)}
                            >
                              Delete
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function SiteEvaluationsPage() {
  return (
    <DashboardPageGuard module="evaluations">
      <SiteEvaluationsPageContent />
    </DashboardPageGuard>
  )
}
