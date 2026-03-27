'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { MapPin, Tractor, Sprout, ChevronLeft } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import {
  api,
  farmsApi,
  reportsApi,
  siteEvaluationsApi,
  type Farm,
  type SiteEvaluation,
} from '@/lib/api'
import { hasPermission, canWriteModule, canReadModule } from '@/lib/permissions'
import { useAuth } from '@/app/context/auth-context'
import { formatINR } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'
import { CreateFarmModal } from './CreateFarmModal'
import { DashboardPageGuard } from '@/components/dashboard/dashboard-page-guard'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { lineString, length as turfLength } from '@turf/turf'
import type { LeafletMapProps } from './LeafletMap'

type BoundaryPoint = { lat: number; lng: number; id: string }

type EvaluationListRow = SiteEvaluation & { proposalId?: string | null }

function siteIdFromEvaluation(e: SiteEvaluation): string {
  const s = e.siteId
  if (s == null) return ''
  if (typeof s === 'object' && '_id' in s) return String((s as { _id: string })._id)
  return String(s)
}

const LeafletMap = dynamic<LeafletMapProps>(() => import('./LeafletMap'), {
  ssr: false,
  loading: () => (
    <div className="h-full min-h-[18rem] bg-gray-100 animate-pulse flex items-center justify-center rounded-lg">
      <span className="text-sm text-muted-foreground">Loading map…</span>
    </div>
  ),
})

export default function FarmsPage() {
  const { user } = useAuth()
  const [farmSites, setFarmSites] = useState<
    { _id: string; name: string; area: number; perimeter?: number; status?: string; createdAt?: string }[]
  >([])
  const [farmSitesLoading, setFarmSitesLoading] = useState(false)
  const [farms, setFarms] = useState<Farm[]>([])
  const [selectedFarmId, setSelectedFarmId] = useState<string | null>(null)
  const [createFarmOpen, setCreateFarmOpen] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [farmsLoading, setFarmsLoading] = useState(true)
  const [siteName, setSiteName] = useState('')
  const [boundaryPoints, setBoundaryPoints] = useState<BoundaryPoint[]>([])
  const [calculatedArea, setCalculatedArea] = useState(0)
  const [savingSite, setSavingSite] = useState(false)
  const [editingSiteId, setEditingSiteId] = useState<string | null>(null)
  const [perimeter, setPerimeter] = useState(0)
  const [lastRecommendation, setLastRecommendation] = useState<{
    infrastructureType: string
    investmentValue: number
    roiMonths: number
  } | null>(null)
  const [lastRecommendationSiteId, setLastRecommendationSiteId] = useState<string | null>(null)
  const [generatingReport, setGeneratingReport] = useState(false)
  const [selectedMapSiteId, setSelectedMapSiteId] = useState<string | null>(null)
  const [mapSiteBoundary, setMapSiteBoundary] = useState<BoundaryPoint[]>([])
  const [mapSiteLoading, setMapSiteLoading] = useState(false)
  const [farmEvaluations, setFarmEvaluations] = useState<EvaluationListRow[]>([])
  const [evaluationsLoading, setEvaluationsLoading] = useState(false)
  const [downloadingEvalPdf, setDownloadingEvalPdf] = useState(false)
  const [generatingProposal, setGeneratingProposal] = useState(false)

  const fetchFarms = useCallback(async () => {
    setFarmsLoading(true)
    try {
      const res = await farmsApi.list()
      if (res.success && res.data) setFarms(res.data)
    } catch {
      setFarms([])
    } finally {
      setFarmsLoading(false)
    }
  }, [])
  const handleDeleteFarm = useCallback(
    async (farmId: string, farmName: string) => {
      if (typeof window !== "undefined" && !window.confirm(`Delete farm "${farmName}"? This will soft-delete the farm.`)) return
      try {
        await farmsApi.remove(farmId)
        toast({ title: "Farm deleted" })
        setSelectedFarmId((prev) => {
          if (prev === farmId) {
            if (typeof window !== "undefined") localStorage.removeItem("lastSelectedFarmId")
            return null
          }
          return prev
        })
        fetchFarms()
      } catch {
        toast({ title: "Failed to delete farm", variant: "destructive" })
      }
    },
    [fetchFarms]
  )

  useEffect(() => {
    fetchFarms()
  }, [fetchFarms])

  const handleSelectFarm = (farmId: string | null) => {
    setSelectedFarmId(farmId)
    if (typeof window !== "undefined") {
      if (farmId) {
        localStorage.setItem("lastSelectedFarmId", farmId)
      } else {
        localStorage.removeItem("lastSelectedFarmId")
      }
    }
  }

  const fetchFarmSites = useCallback(async () => {
    if (!selectedFarmId) {
      setFarmSites([])
      return
    }
    setFarmSitesLoading(true)
    try {
      const res = await farmsApi.getSites(selectedFarmId)
      if (res.success && res.data) {
        setFarmSites(res.data)
      } else {
        setFarmSites([])
      }
    } catch {
      setFarmSites([])
    } finally {
      setFarmSitesLoading(false)
    }
  }, [selectedFarmId])

  useEffect(() => {
    void fetchFarmSites()
  }, [fetchFarmSites])

  const fetchFarmEvaluations = useCallback(async () => {
    if (!selectedFarmId) {
      setFarmEvaluations([])
      return
    }
    setEvaluationsLoading(true)
    try {
      const res = await siteEvaluationsApi.list({ farmId: selectedFarmId })
      if (res.success && Array.isArray(res.data)) {
        setFarmEvaluations(res.data as EvaluationListRow[])
      } else {
        setFarmEvaluations([])
      }
    } catch {
      setFarmEvaluations([])
    } finally {
      setEvaluationsLoading(false)
    }
  }, [selectedFarmId])

  useEffect(() => {
    void fetchFarmEvaluations()
  }, [fetchFarmEvaluations])

  const selectedSiteEval = useMemo(() => {
    if (!selectedMapSiteId || farmEvaluations.length === 0) return null
    const matches = farmEvaluations.filter((e) => siteIdFromEvaluation(e) === selectedMapSiteId)
    if (matches.length === 0) return null
    return [...matches].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )[0]
  }, [selectedMapSiteId, farmEvaluations])

  useEffect(() => {
    setSelectedMapSiteId(null)
  }, [selectedFarmId])

  useEffect(() => {
    if (!selectedMapSiteId) {
      setMapSiteBoundary([])
      setMapSiteLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      setMapSiteLoading(true)
      try {
        const token = typeof window !== "undefined" ? localStorage.getItem("forge_token") : null
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"
        const res = await fetch(`${apiUrl}/api/sites/${selectedMapSiteId}`, {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            "Content-Type": "application/json",
          },
        })
        if (!res.ok) throw new Error("Failed to load site")
        const json = await res.json()
        const siteData = json?.data
        if (cancelled) return
        if (process.env.NODE_ENV === 'development') {
          console.log('Selected site:', siteData)
        }
        if (!siteData?.geojson?.coordinates?.[0]) {
          setMapSiteBoundary([])
          return
        }
        const pts: BoundaryPoint[] = siteData.geojson.coordinates[0]
          .slice(0, -1)
          .map((c: number[], i: number) => ({
            id: `map-${i}`,
            lat: c[1],
            lng: c[0],
          }))
        setMapSiteBoundary(pts)
      } catch {
        if (!cancelled) setMapSiteBoundary([])
      } finally {
        if (!cancelled) setMapSiteLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [selectedMapSiteId])

  const mapReadOnlyCenter =
    mapSiteBoundary.length > 0
      ? {
          lat: mapSiteBoundary.reduce((s, p) => s + p.lat, 0) / mapSiteBoundary.length,
          lng: mapSiteBoundary.reduce((s, p) => s + p.lng, 0) / mapSiteBoundary.length,
        }
      : null

  const computePerimeter = (points: BoundaryPoint[]): number => {
    if (points.length < 2) return 0
    const coords = points.map((p) => [p.lng, p.lat])
    coords.push(coords[0])
    return Number((turfLength(lineString(coords), { units: 'kilometers' }) * 1000).toFixed(2))
  }

  const handleSaveSite = async () => {
    if (boundaryPoints.length < 3) {
      toast({
        title: 'Cannot save site',
        description: 'Draw at least 3 boundary points before saving.',
        variant: 'destructive',
      })
      return
    }

    if (!siteName.trim() || !calculatedArea) {
      return
    }

    const token = localStorage.getItem('forge_token')
    const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

    setSavingSite(true)

    try {
      const coords = boundaryPoints.map((p) => [p.lng, p.lat])
      if (coords.length > 0) {
        coords.push(coords[0])
      }

      const slope = 2.5
      const payload = {
        name: siteName.trim(),
        geojson: {
          type: 'Polygon' as const,
          coordinates: [coords],
        },
        area: calculatedArea,
        perimeter,
        slope,
        ...(selectedFarmId ? { farmId: selectedFarmId } : {}),
      }

      const url = editingSiteId
        ? `${baseURL}/api/sites/${editingSiteId}`
        : `${baseURL}/api/sites`
      const method = editingSiteId ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      })

      if (!res.ok) throw new Error('Failed to save site')

      const siteJson = await res.json()
      const createdSiteId = siteJson?.data?._id ?? siteJson?.data?.id

      toast({
        title: editingSiteId ? 'Site updated' : 'Site saved. Calculating recommendations…',
      })

      setEditingSiteId(null)
      setSiteName('')
      setBoundaryPoints([])
      setCalculatedArea(0)
      setPerimeter(0)
      setLastRecommendation(null)
      setLastRecommendationSiteId(null)
      void fetchFarmSites()
      void fetchFarmEvaluations()

      if (!editingSiteId && createdSiteId && calculatedArea) {
        try {
          const recRes = await fetch(`${baseURL}/api/proposals/recommend`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              siteId: createdSiteId,
              area: calculatedArea,
              slope,
            }),
          })
          if (recRes.ok) {
            const recJson = await recRes.json()
            const data = recJson?.data
            if (data) {
              setLastRecommendationSiteId(createdSiteId)
              setLastRecommendation({
                infrastructureType: data.infrastructureType ?? '—',
                investmentValue: data.investmentValue ?? 0,
                roiMonths: data.roiMonths ?? 0,
              })
              toast({
                title: 'Recommendation ready',
                description: `${data.infrastructureType}: ₹${Number(data.investmentValue ?? 0).toLocaleString('en-IN')}, ROI ${data.roiMonths} months`,
              })
            }
          }
        } catch {
          // non-blocking
        }
      }
    } catch (err) {
      console.error(err)
      toast({
        title: 'Failed to save site',
        description: 'Please try again.',
        variant: 'destructive',
      })
    } finally {
      setSavingSite(false)
    }
  }

  const handleFarmCreated = useCallback((farm: Farm) => {
    setFarms((prev) => [...prev, farm])
    setSelectedFarmId(farm._id)
    if (typeof window !== "undefined") {
      localStorage.setItem("lastSelectedFarmId", farm._id)
    }
  }, [])

  const handleEditSite = (site: { id: string; name: string; boundary: BoundaryPoint[]; area: number }) => {
    setEditingSiteId(site.id)
    setSiteName(site.name)
    setBoundaryPoints(site.boundary)
    setCalculatedArea(site.area)
  }

  const handleDeleteSite = async (site: { id: string }) => {
    const confirmed = window.confirm('Are you sure you want to delete this site?')
    if (!confirmed) return

    const token = localStorage.getItem('forge_token')
    const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

    try {
      const res = await fetch(`${baseURL}/api/sites/${site.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })
      if (!res.ok) throw new Error('Failed to delete site')
      if (editingSiteId === site.id) {
        setEditingSiteId(null)
        setSiteName('')
        setBoundaryPoints([])
        setCalculatedArea(0)
        setPerimeter(0)
      }
      toast({ title: 'Site deleted' })
      void fetchFarmSites()
      void fetchFarmEvaluations()
    } catch (err) {
      console.error(err)
      toast({
        title: 'Failed to delete site',
        description: 'Please try again.',
        variant: 'destructive',
      })
    }
  }

  const handleDownloadEvaluationPdf = async () => {
    if (!selectedMapSiteId || !selectedSiteEval) return
    if (!hasPermission(user, 'canGenerateReports')) {
      toast({ title: 'No permission to generate reports', variant: 'destructive' })
      return
    }
    setDownloadingEvalPdf(true)
    try {
      const res = await reportsApi.generate({
        reportType: 'site_evaluation',
        format: 'pdf',
        siteIds: [selectedMapSiteId],
      })
      const downloadUrl = res?.data?.downloadUrl
      const fileName = res?.data?.fileName
      if (!downloadUrl || !fileName) throw new Error('Invalid response')
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'
      const t = localStorage.getItem('forge_token')
      const fileRes = await fetch(apiUrl + downloadUrl, {
        headers: t ? { Authorization: `Bearer ${t}` } : {},
      })
      if (!fileRes.ok) throw new Error('Download failed')
      const blob = await fileRes.blob()
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = fileName
      a.click()
      URL.revokeObjectURL(objectUrl)
      toast({ title: 'Download started', description: 'Site evaluation PDF' })
    } catch {
      toast({ title: 'Report failed', variant: 'destructive' })
    } finally {
      setDownloadingEvalPdf(false)
    }
  }

  const handleGenerateProposal = async () => {
    if (!selectedMapSiteId) return
    if (!hasPermission(user, 'canGenerateProposal')) {
      toast({ title: 'No permission', variant: 'destructive' })
      return
    }
    const siteRow = farmSites.find((s) => s._id === selectedMapSiteId)
    const area = siteRow?.area != null ? Number(siteRow.area) : 0
    setGeneratingProposal(true)
    try {
      await api.post('/api/proposals/recommend', {
        siteId: selectedMapSiteId,
        area,
        slope: 2.5,
      })
      toast({ title: 'Proposal generated', description: 'Infrastructure recommendation saved for this site.' })
      void fetchFarmEvaluations()
    } catch {
      toast({ title: 'Could not generate proposal', variant: 'destructive' })
    } finally {
      setGeneratingProposal(false)
    }
  }

  const getSiteStatusBadge = (status?: string) => {
    if (status === 'approved') return 'bg-green-100 text-green-800'
    if (status === 'submitted') return 'bg-blue-100 text-blue-800'
    if (status === 'draft') return 'bg-orange-100 text-orange-800'
    return 'bg-gray-100 text-gray-800'
  }

  const selectedFarm = useMemo(
    () => (selectedFarmId ? farms.find((f) => f._id === selectedFarmId) ?? null : null),
    [farms, selectedFarmId]
  )

  const formatFarmLocation = (farm: Farm) => {
    if (farm.location?.trim()) return farm.location.trim()
    const parts = [farm.district, farm.state, farm.country].filter(Boolean) as string[]
    return parts.length > 0 ? parts.join(", ") : "—"
  }

  const formatFarmDate = (iso?: string) => {
    if (!iso) return "—"
    const d = new Date(iso)
    return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString()
  }

  return (
    <DashboardPageGuard module="farms">
    <div className="space-y-6">
      <CreateFarmModal
        open={createFarmOpen}
        onOpenChange={setCreateFarmOpen}
        onSuccess={handleFarmCreated}
      />

      {selectedFarmId === null ? (
        <>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Farms</h1>
              <p className="text-muted-foreground">Select a farm to manage sites and boundaries</p>
            </div>
            {canWriteModule(user, "farms") && (
              <Button
                type="button"
                className="shrink-0 !bg-green-600 hover:!bg-green-700 !text-white"
                onClick={() => setCreateFarmOpen(true)}
                disabled={farmsLoading}
              >
                + New Farm
              </Button>
            )}
          </div>

          {farmsLoading ? (
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              </CardContent>
            </Card>
          ) : farms.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 px-6 text-center">
                <Tractor className="h-12 w-12 text-muted-foreground/45 mb-4" />
                <p className="text-lg font-medium text-foreground">No farms yet</p>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                  Create your first farm to start mapping sites and running evaluations.
                </p>
                {canWriteModule(user, "farms") && (
                  <Button
                    type="button"
                    className="mt-6 !bg-green-600 hover:!bg-green-700 !text-white"
                    onClick={() => setCreateFarmOpen(true)}
                  >
                    Create Farm
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0 sm:p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Farm Name</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead className="text-right">Total Sites</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right w-[280px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {farms.map((farm) => (
                      <TableRow key={farm._id}>
                        <TableCell className="font-medium">{farm.name}</TableCell>
                        <TableCell className="text-muted-foreground max-w-[200px] truncate" title={formatFarmLocation(farm)}>
                          {formatFarmLocation(farm)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {farm.siteCount != null ? farm.siteCount : "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground whitespace-nowrap">
                          {formatFarmDate(farm.createdAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <Button
                              type="button"
                              size="sm"
                              className="bg-[#387F43] hover:bg-[#2d6535] text-white"
                              onClick={() => handleSelectFarm(farm._id)}
                            >
                              Open
                            </Button>
                            <Button type="button" variant="outline" size="sm" asChild>
                              <Link href={`/dashboard/farms/${farm._id}/sites`}>Edit</Link>
                            </Button>
                            {hasPermission(user, "canDeleteFarm") && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => void handleDeleteFarm(farm._id, farm.name)}
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
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-fit -ml-2 shrink-0 text-muted-foreground hover:text-foreground"
              onClick={() => handleSelectFarm(null)}
            >
              <ChevronLeft className="h-4 w-4 mr-1" aria-hidden />
              Back to Farms
            </Button>
            {selectedFarm && (
              <div className="flex flex-col gap-0.5 sm:items-end sm:text-right">
                <p className="text-base font-bold text-foreground">{selectedFarm.name}</p>
                {formatFarmLocation(selectedFarm) !== "—" && (
                  <p className="text-sm text-muted-foreground">{formatFarmLocation(selectedFarm)}</p>
                )}
              </div>
            )}
          </div>

      <div className="grid grid-cols-12 gap-4">
        <aside className="col-span-12 lg:col-span-3 bg-white rounded-lg border p-4 flex flex-col min-h-[min(640px,calc(100vh-140px))] space-y-4">
          <h2 className="text-base font-semibold text-foreground">Farms &amp; Sites</h2>

          {farmsLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-16 w-full rounded-lg" />
              <Skeleton className="h-16 w-full rounded-lg" />
            </div>
          ) : farms.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 py-10 px-2 text-center rounded-lg border border-dashed border-muted-foreground/20 bg-muted/15">
              <Tractor className="h-11 w-11 text-muted-foreground/45 mb-3" />
              <p className="font-medium text-foreground text-sm">No farms loaded</p>
              <p className="text-xs text-muted-foreground mt-1">
                Go back to Farms and refresh the list.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Select
                  value={selectedFarmId ?? ""}
                  onValueChange={(v) => handleSelectFarm(v || null)}
                  disabled={farmsLoading}
                >
                  <SelectTrigger className="w-full">
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
                {hasPermission(user, "canDeleteFarm") && selectedFarmId && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs text-red-600 hover:text-red-700 hover:bg-red-50 h-8"
                    onClick={() => {
                      const f = farms.find((x) => x._id === selectedFarmId)
                      if (f) void handleDeleteFarm(f._id, f.name)
                    }}
                  >
                    Delete this farm
                  </Button>
                )}
              </div>

              <hr className="my-3 border-border" />

              <div className="flex flex-col flex-1 min-h-0 space-y-4">
                <div className="max-h-[70vh] overflow-y-auto flex-1 min-h-0 -mx-1 px-1 space-y-2">
                  {!selectedFarmId ? (
                    <p className="text-sm text-muted-foreground py-2 px-1">Select a farm to view sites</p>
                  ) : farmSitesLoading ? (
                    <p className="text-sm text-muted-foreground py-2 px-1">Loading sites…</p>
                  ) : farmSites.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 px-2 text-center rounded-lg border border-dashed border-muted-foreground/15 bg-muted/10">
                      <Sprout className="h-9 w-9 text-muted-foreground/40 mb-2" />
                      <p className="text-sm font-medium text-foreground">No sites yet</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Click &quot;Draw new site&quot; to begin.
                      </p>
                    </div>
                  ) : (
                    farmSites.map((site) => (
                      <div
                        key={site._id}
                        className={`rounded-lg border-2 transition-all duration-150 ${
                          selectedMapSiteId === site._id
                            ? "bg-green-50 border-[#387F43] shadow-sm"
                            : "border-transparent bg-transparent hover:bg-muted/50 hover:border-muted-foreground/20"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedMapSiteId(site._id)}
                          className="w-full text-left px-3 py-3 rounded-lg bg-transparent"
                        >
                          <div className="font-medium text-sm text-gray-900">{site.name}</div>
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <span className="text-xs text-muted-foreground">
                              {Number(site.area).toFixed(2)} acres
                            </span>
                            <Badge className={`text-[10px] ${getSiteStatusBadge(site.status)}`}>
                              {site.status ?? "draft"}
                            </Badge>
                          </div>
                        </button>
                        <div className="px-3 pb-2">
                          <Link
                            href={`/dashboard/farms/${selectedFarmId}/sites/${site._id}`}
                            className="text-xs text-[#387F43] hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Open details →
                          </Link>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                {selectedFarmId && (
                  <button
                    type="button"
                    onClick={() => setSelectedMapSiteId(null)}
                    className="w-full shrink-0 py-2.5 border-2 border-dashed border-gray-200 rounded-lg text-sm text-gray-600 hover:border-[#387F43]/50 hover:text-[#387F43] hover:bg-green-50/30 transition-colors"
                  >
                    + Draw new site
                  </button>
                )}
              </div>
            </>
          )}
        </aside>

        <div className="col-span-12 lg:col-span-9 flex flex-col min-h-0">
        <div className="h-[calc(100vh-140px)] rounded-lg overflow-hidden border bg-gray-50 flex flex-col">
          {selectedMapSiteId ? (
            <div className="flex flex-col h-full min-h-0 p-4">
              <div className="flex items-center justify-between gap-2 mb-2 shrink-0">
                <p className="text-sm font-medium text-gray-700">Site boundary</p>
                <Button type="button" variant="outline" size="sm" onClick={() => setSelectedMapSiteId(null)}>
                  Draw new site
                </Button>
              </div>
              <div className="flex-1 min-h-0 flex flex-col gap-3">
                <div className="flex-1 min-h-0 rounded-lg border overflow-hidden bg-white">
                  {mapSiteLoading ? (
                    <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                      Loading map…
                    </div>
                  ) : mapSiteBoundary.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400 p-4 text-center text-sm">
                      No boundary data for this site.
                    </div>
                  ) : (
                    <div className="h-full w-full min-h-[200px]">
                      <LeafletMap
                        readOnly
                        boundary={mapSiteBoundary}
                        initialBoundary={mapSiteBoundary}
                        initialCenter={mapReadOnlyCenter}
                        onBoundaryChange={() => {}}
                        isFullscreen={isFullscreen}
                        onExitFullscreen={() => setIsFullscreen(false)}
                      />
                    </div>
                  )}
                </div>
                {selectedFarmId && (
                  <div className="shrink-0 rounded-md border bg-white p-3 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Site actions
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {canWriteModule(user, "evaluations") && (
                        <Button variant="outline" size="sm" asChild>
                          <Link
                            href={`/dashboard/site-evaluations/new?siteId=${encodeURIComponent(selectedMapSiteId)}&farmId=${encodeURIComponent(selectedFarmId)}`}
                          >
                            Evaluate Site
                          </Link>
                        </Button>
                      )}
                      {selectedSiteEval && hasPermission(user, "canGenerateReports") && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="border-[#387F43] text-[#387F43] hover:bg-green-50"
                          disabled={downloadingEvalPdf}
                          onClick={() => void handleDownloadEvaluationPdf()}
                        >
                          {downloadingEvalPdf ? "Generating…" : "Download Evaluation PDF"}
                        </Button>
                      )}
                      {selectedSiteEval?.proposalId && canReadModule(user, "evaluations") ? (
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/dashboard/site-evaluations/${selectedSiteEval._id}`}>
                            View Proposal
                          </Link>
                        </Button>
                      ) : (
                        hasPermission(user, "canGenerateProposal") && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={generatingProposal}
                            onClick={() => void handleGenerateProposal()}
                          >
                            {generatingProposal ? "Working…" : "Generate Proposal"}
                          </Button>
                        )
                      )}
                    </div>
                    {evaluationsLoading && (
                      <p className="text-xs text-muted-foreground">Loading evaluation data…</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : !createFarmOpen ? (
            <Card className="border-0 shadow-none rounded-none bg-transparent h-full min-h-0 flex flex-col">
              <CardHeader className="pb-2 shrink-0">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <CardTitle>Land Boundary Mapping</CardTitle>
                    <CardDescription>
                      Click on the map to add boundary points and save the site.
                    </CardDescription>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsFullscreen(true)}
                  >
                    Full screen
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="space-y-4 flex-1 flex flex-col min-h-0 overflow-auto">
                <div className="flex-1 min-h-[240px] w-full overflow-hidden rounded-lg border bg-white">
                  <LeafletMap
                    boundary={boundaryPoints}
                    onBoundaryChange={(points: BoundaryPoint[], area: number) => {
                      setBoundaryPoints(points)
                      setCalculatedArea(area)
                      setPerimeter(computePerimeter(points))
                    }}
                    isFullscreen={isFullscreen}
                    onExitFullscreen={() => setIsFullscreen(false)}
                  />
                </div>

                <div className="flex flex-wrap gap-2 text-xs">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                  setBoundaryPoints((prev) => {
                    const next = prev.slice(0, prev.length - 1)
                    setCalculatedArea(
                      calculatedArea && next.length ? calculatedArea : 0
                    )
                    setPerimeter(computePerimeter(next))
                    return next
                  })
                    }
                    disabled={boundaryPoints.length === 0}
                  >
                    Undo Last Point
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setBoundaryPoints([])
                      setCalculatedArea(0)
                    }}
                    disabled={boundaryPoints.length === 0}
                  >
                    Clear All Points
                  </Button>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    className="flex-1 rounded-md border px-3 py-2 text-sm"
                    placeholder="Site name"
                    value={siteName}
                    onChange={(e) => setSiteName(e.target.value)}
                  />

                  {canWriteModule(user, "sites") && (
                    <Button
                      onClick={handleSaveSite}
                      disabled={
                        savingSite ||
                        !siteName.trim() ||
                        !selectedFarmId ||
                        boundaryPoints.length < 3 ||
                        !calculatedArea
                      }
                    >
                      {editingSiteId
                        ? savingSite
                          ? 'Updating…'
                          : 'Update Site'
                        : savingSite
                          ? 'Saving…'
                          : 'Save Site'}
                    </Button>
                  )}
                </div>

                {boundaryPoints.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Points: {boundaryPoints.length} • Area:{' '}
                    {calculatedArea != null ? `${calculatedArea.toFixed(2)} acres` : '—'} • Perimeter:{' '}
                    {perimeter != null ? `${perimeter.toFixed(0)} m` : '—'} • Slope: 2.5%
                  </p>
                )}
                {lastRecommendation && (
                  <div className="mt-4 p-4 rounded-lg border-2 border-[#387F43]/30 bg-[#387F43]/5">
                    <p className="text-sm font-semibold text-[#387F43] mb-3 flex items-center gap-2">
                      <span>⚡</span> Recommendation Ready
                    </p>
                    <p className="text-sm"><span className="font-medium">Infrastructure:</span> {lastRecommendation.infrastructureType}</p>
                    <p className="text-sm"><span className="font-medium">Investment:</span> {formatINR(lastRecommendation.investmentValue)}</p>
                    <p className="text-sm mb-3"><span className="font-medium">ROI:</span> {lastRecommendation.roiMonths} months</p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="bg-[#387F43] hover:bg-[#2d6535]"
                        disabled={generatingReport}
                        onClick={async () => {
                          setGeneratingReport(true)
                          try {
                            const res = await reportsApi.generate({ reportType: 'infrastructure_proposal', format: 'pdf' })
                            const downloadUrl = res?.data?.downloadUrl
                            const fileName = res?.data?.fileName
                            if (!downloadUrl || !fileName) throw new Error('Invalid response')
                            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'
                            const t = localStorage.getItem('forge_token')
                            const fileRes = await fetch(apiUrl + downloadUrl, { headers: t ? { Authorization: `Bearer ${t}` } : {} })
                            if (!fileRes.ok) throw new Error('Download failed')
                            const blob = await fileRes.blob()
                            const objectUrl = URL.createObjectURL(blob)
                            const a = document.createElement('a')
                            a.href = objectUrl
                            a.download = fileName
                            a.click()
                            URL.revokeObjectURL(objectUrl)
                            toast({ title: 'Report generated', description: 'Download started.' })
                          } catch (e) {
                            toast({ title: 'Report failed', variant: 'destructive' })
                          } finally {
                            setGeneratingReport(false)
                          }
                        }}
                      >
                        {generatingReport ? 'Generating…' : 'Generate Report'}
                      </Button>
                      {lastRecommendationSiteId && (
                        <Button size="sm" variant="outline" asChild>
                          <Link href={`/dashboard/finance?siteId=${lastRecommendationSiteId}`}>View in Finance</Link>
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 p-8 text-center">
              <MapPin className="w-16 h-16 mb-4 opacity-30" />
              <p className="text-sm font-medium text-gray-600">Finish farm setup</p>
              <p className="text-xs mt-1 text-muted-foreground max-w-xs">
                Complete the dialog above, then draw a new site on the map.
              </p>
            </div>
          )}
        </div>
        </div>
      </div>
        </>
      )}

    </div>
    </DashboardPageGuard>
  )
}