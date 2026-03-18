'use client'

import { useState, useEffect, useCallback } from 'react'
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
import { MapPin } from 'lucide-react'
import { farmsApi, reportsApi, type Farm } from '@/lib/api'
import { getUserRole, hasPermission } from '@/lib/permissions'
import { formatINR } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { toast } from '@/hooks/use-toast'
import { CreateFarmModal } from './CreateFarmModal'
import { lineString, length as turfLength } from '@turf/turf'

type BoundaryPoint = { lat: number; lng: number; id: string }

interface LeafletMapProps {
  boundary: BoundaryPoint[]
  onBoundaryChange: (points: BoundaryPoint[], area: number) => void
  isFullscreen: boolean
  onExitFullscreen: () => void
}

// @ts-ignore dynamic import typed via LeafletMapProps
const LeafletMap = dynamic<LeafletMapProps>(() => import('./LeafletMap'), {
  ssr: false,
  loading: () => (
    <div className="h-full min-h-[18rem] bg-gray-100 animate-pulse flex items-center justify-center rounded-lg">
      <span className="text-sm text-muted-foreground">Loading map…</span>
    </div>
  ),
})

export default function FarmsPage() {
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
  const [role, setRole] = useState('sales_associate')

  useEffect(() => {
    setRole(getUserRole())
  }, [])

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

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!farms.length) return
    if (selectedFarmId) return

    const last = localStorage.getItem("lastSelectedFarmId")
    if (last && farms.find((f) => f._id === last)) {
      setSelectedFarmId(last)
    } else {
      setSelectedFarmId(farms[0]._id)
    }
  }, [farms, selectedFarmId])

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
    } catch (err) {
      console.error(err)
      toast({
        title: 'Failed to delete site',
        description: 'Please try again.',
        variant: 'destructive',
      })
    }
  }

  const getSiteStatusBadge = (status?: string) => {
    if (status === 'approved') return 'bg-green-100 text-green-800'
    if (status === 'submitted') return 'bg-blue-100 text-blue-800'
    if (status === 'draft') return 'bg-orange-100 text-orange-800'
    return 'bg-gray-100 text-gray-800'
  }

  return (
    <div className="space-y-6">
      <CreateFarmModal
        open={createFarmOpen}
        onOpenChange={setCreateFarmOpen}
        onSuccess={handleFarmCreated}
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Farms</h1>
          <p className="text-muted-foreground">
            Manage farms and site evaluations
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {hasPermission(role, 'canCreateFarm') && (
            <Button
              className="bg-[#387F43] hover:bg-[#2d6535]"
              onClick={() => setCreateFarmOpen(true)}
              disabled={farmsLoading}
            >
              Create Farm
            </Button>
          )}
          <Select
            value={selectedFarmId ?? ''}
            onValueChange={(v) => handleSelectFarm(v || null)}
            disabled={farmsLoading}
          >
            <SelectTrigger className="w-[220px]">
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
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {farmsLoading ? (
          <p className="text-sm text-muted-foreground col-span-full">Loading farms...</p>
        ) : (
          farms.map((farm) => (
            <Card key={farm._id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-lg">{farm.name}</CardTitle>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      asChild
                    >
                      <Link href={`/dashboard/farms/${farm._id}/sites`}>View Sites</Link>
                    </Button>
                    {hasPermission(role, 'canDeleteFarm') && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => handleDeleteFarm(farm._id, farm.name)}
                      >
                        Delete
                      </Button>
                    )}
                  </div>
                </div>
                <CardDescription>
                  {farm.location || "No location"} • {(farm as { siteCount?: number }).siteCount ?? 0} sites
                </CardDescription>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                Created {formatDistanceToNow(new Date(farm.createdAt), { addSuffix: true })}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Sites</CardTitle>
              <CardDescription>
                {selectedFarmId ? `${farmSites.length} site(s)` : 'Select a farm to view its sites'}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-3">
              {!selectedFarmId ? (
                <p className="text-sm text-muted-foreground">
                  Select a farm from the dropdown to view its sites.
                </p>
              ) : farmSitesLoading ? (
                <p className="text-sm text-muted-foreground">Loading sites...</p>
              ) : farmSites.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No sites yet. Draw a boundary on the map to create one.
                </p>
              ) : (
                <>
                  {farmSites.map((site) => (
                    <Link
                      key={site._id}
                      href={`/dashboard/farms/${selectedFarmId}/sites/${site._id}`}
                    >
                      <div className="p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                        <div className="space-y-1">
                          <p className="font-medium text-sm">{site.name}</p>
                          <p className="text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3 inline mr-1" />
                            Area: {site.area} acres
                            {site.perimeter != null ? ` • Perimeter: ${site.perimeter} m` : ''}
                          </p>
                          <div className="flex items-center justify-between gap-2">
                            <Badge className={`text-xs ${getSiteStatusBadge(site.status)}`}>
                              {site.status ?? 'draft'}
                            </Badge>
                            {site.createdAt && (
                              <span className="text-[10px] text-muted-foreground">
                                {formatDistanceToNow(new Date(site.createdAt), { addSuffix: true })}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full mt-2"
                    asChild
                  >
                    <Link href={`/dashboard/farms/${selectedFarmId}/sites`}>View All Sites</Link>
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-3">
          {!createFarmOpen && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <CardTitle>Select Site Location</CardTitle>
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
                    Full Screen
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="h-72 w-full overflow-hidden rounded-lg border">
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

                  {hasPermission(role, 'canCreateSite') && (
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
          )}
        </div>
      </div>

    </div>
  )
}