"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
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
import { siteEvaluationsApi, farmsApi, type Farm, type SiteEvaluation } from "@/lib/api"
import { formatDistanceToNow } from "date-fns"
import { toast } from "@/hooks/use-toast"

const baseURL =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL) || "http://localhost:5000"

function statusBadge(status: string) {
  const map: Record<string, string> = {
    draft: "bg-gray-100 text-gray-800",
    submitted: "bg-blue-100 text-blue-800",
    approved: "bg-green-100 text-green-800",
    rejected: "bg-red-100 text-red-800",
  }
  return map[status] ?? "bg-gray-100 text-gray-800"
}

export default function SiteEvaluationsPage() {
  const [evaluations, setEvaluations] = useState<(SiteEvaluation & { siteId?: { name?: string; area?: number }; proposalId?: string | null })[]>([])
  const [farms, setFarms] = useState<Farm[]>([])
  const [sites, setSites] = useState<{ _id: string; name: string; area: number }[]>([])
  const [sitesLoading, setSitesLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [selectedFarmId, setSelectedFarmId] = useState<string>("")
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

  const fetchEvaluations = useCallback(async () => {
    setLoading(true)
    try {
      const res = await siteEvaluationsApi.list()
      if (res.success && res.data) setEvaluations(res.data)
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
  }, [fetchEvaluations])

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
        const { proposal } = res.data as { proposal?: { infrastructureType?: string; investmentValue?: number; roiMonths?: number } }
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
    } catch (err) {
      toast({ title: "Failed to create evaluation", variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  const handleGenerateReport = async (proposalId: string) => {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("forge_token") : null
      const res = await fetch(`${baseURL}/api/reports/proposal/${proposalId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })
      const json = await res.json()
      if (json.success && json.data?.downloadUrl) {
        const url = `${baseURL}${json.data.downloadUrl}`
        window.open(url, "_blank")
        toast({ title: "Report generated", description: "Download started." })
      } else {
        toast({ title: "Report failed", variant: "destructive" })
      }
    } catch {
      toast({ title: "Report failed", variant: "destructive" })
    }
  }

  const siteName = (ev: SiteEvaluation & { siteId?: { name?: string; area?: number } }) =>
    typeof ev.siteId === "object" && ev.siteId?.name
      ? ev.siteId.name
      : ev.name ?? "—"
  const siteArea = (ev: SiteEvaluation & { siteId?: { area?: number } }) =>
    typeof ev.siteId === "object" && ev.siteId?.area != null
      ? ev.siteId.area
      : ev.area ?? "—"

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Site Evaluations</h1>
          <p className="text-muted-foreground">Infrastructure suitability and proposals</p>
        </div>
        <Button className="bg-[#387F43] hover:bg-[#2d6535]" onClick={() => setFormOpen(true)}>
          New Evaluation
        </Button>
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
                      <SelectItem key={f._id} value={f._id}>{f.name}</SelectItem>
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
                    <SelectValue placeholder={form.farmId && sitesLoading ? "Loading sites..." : "Select site"} />
                  </SelectTrigger>
                  <SelectContent>
                    {sites.map((s) => (
                      <SelectItem key={s._id} value={s._id}>{s.name} ({s.area} ac)</SelectItem>
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
                  onValueChange={(v) => setForm((f) => ({ ...f, sunExposure: v as "full" | "partial" | "shade" }))}
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

      <Card>
        <CardHeader>
          <CardTitle>Evaluations</CardTitle>
          <CardDescription>{evaluations.length} evaluation(s)</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground animate-pulse">Loading...</p>
          ) : evaluations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No site evaluations yet. Create one to get started.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Site</TableHead>
                  <TableHead>Farm</TableHead>
                  <TableHead>Soil</TableHead>
                  <TableHead>Water</TableHead>
                  <TableHead>Slope %</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {evaluations.map((ev) => (
                  <TableRow key={ev._id}>
                    <TableCell>{siteName(ev)}</TableCell>
                    <TableCell>{ev.farmId ?? "—"}</TableCell>
                    <TableCell>{ev.soilType ?? "—"}</TableCell>
                    <TableCell>{ev.waterAvailability ?? "—"}</TableCell>
                    <TableCell>{ev.slopePercentage ?? "—"}</TableCell>
                    <TableCell>
                      <Badge className={statusBadge(ev.status)}>{ev.status}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDistanceToNow(new Date(ev.createdAt), { addSuffix: true })}
                    </TableCell>
                    <TableCell className="space-x-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/dashboard/site-evaluations/${ev._id}`}>View</Link>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!(ev as { proposalId?: string | null }).proposalId}
                        title={!(ev as { proposalId?: string | null }).proposalId ? "No proposal yet" : undefined}
                        onClick={() => (ev as { proposalId?: string }).proposalId && handleGenerateReport((ev as { proposalId: string }).proposalId)}
                      >
                        Generate Report
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
