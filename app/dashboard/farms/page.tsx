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
import { MapPin, CheckCircle, Clock, AlertCircle } from 'lucide-react'
import { siteEvaluationsApi, farmsApi, type SiteEvaluation, type Farm } from '@/lib/api'
import { formatDistanceToNow } from 'date-fns'
import { toast } from '@/hooks/use-toast'
import { CreateFarmModal } from './CreateFarmModal'

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
})

interface ActiveSite {
  id: string
  name: string
  status: string
  lastMarked: string
  area: number
}

function toActiveSite(e: SiteEvaluation): ActiveSite {
  return {
    id: e._id,
    name: e.name,
    status: e.status,
    lastMarked: formatDistanceToNow(new Date(e.updatedAt), { addSuffix: true }),
    area: e.area,
  }
}

export default function FarmsPage() {
  const [activeSites, setActiveSites] = useState<ActiveSite[]>([])
  const [loading, setLoading] = useState(true)
  const [farms, setFarms] = useState<Farm[]>([])
  const [selectedFarmId, setSelectedFarmId] = useState<string | null>(null)
  const [createFarmOpen, setCreateFarmOpen] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [farmsLoading, setFarmsLoading] = useState(true)
  const [siteName, setSiteName] = useState('')
  const [boundaryPoints, setBoundaryPoints] = useState<BoundaryPoint[]>([])
  const [calculatedArea, setCalculatedArea] = useState(0)
  const [savingSite, setSavingSite] = useState(false)

  const fetchFarms = useCallback(async () => {
    setFarmsLoading(true)
    try {
      const res = await farmsApi.list()
      if (res.success) setFarms(res.data)
    } catch {
      setFarms([])
    } finally {
      setFarmsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchFarms()
  }, [fetchFarms])

  const fetchSites = useCallback(async () => {
    setLoading(true)
    try {
      const res = await siteEvaluationsApi.list(selectedFarmId ?? undefined)
      if (res.success) setActiveSites(res.data.map(toActiveSite))
    } catch {
      setActiveSites([])
    } finally {
      setLoading(false)
    }
  }, [selectedFarmId])

  useEffect(() => {
    fetchSites()
  }, [fetchSites])

  const handleSaveSite = async () => {
    if (!siteName.trim() || !selectedFarmId || boundaryPoints.length < 3 || !calculatedArea) {
      return
    }

    const token = localStorage.getItem('forge_token')
    const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

    setSavingSite(true)

    try {
      const payload = {
        name: siteName.trim(),
        area: calculatedArea,
        areaUnit: 'acres',
        boundary: boundaryPoints,
        status: 'draft',
        farmId: selectedFarmId,
      }

      const res = await fetch(`${baseURL}/api/site-evaluations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      })

      if (!res.ok) throw new Error('Failed to save site')

      toast({
        title: 'Site saved',
        description: 'Site evaluation created successfully.',
      })

      setSiteName('')
      setBoundaryPoints([])
      setCalculatedArea(0)
      fetchSites()
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'submitted':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'draft':
        return <Clock className="h-4 w-4 text-orange-600" />
      default:
        return <AlertCircle className="h-4 w-4 text-gray-400" />
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      submitted: 'bg-green-100 text-green-800',
      draft: 'bg-orange-100 text-orange-800',
    }
    return variants[status] ?? 'bg-gray-100 text-gray-800'
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
            Satellite map-based site evaluation and land boundary marking
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={selectedFarmId ?? ''}
            onValueChange={(v) => setSelectedFarmId(v || null)}
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

          <Button
            variant="outline"
            onClick={() => setCreateFarmOpen(true)}
            disabled={farmsLoading}
          >
            New farm
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Active Sites</CardTitle>
              <CardDescription>{activeSites.length} sites</CardDescription>
            </CardHeader>

            <CardContent className="space-y-3">
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading sites...</p>
              ) : (
                activeSites.map((site) => (
                  <Link key={site.id} href={`/dashboard/site-evaluations/${site.id}`}>
                    <div className="p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                      <p className="font-medium text-sm">{site.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        <MapPin className="h-3 w-3 inline mr-1" />
                        {site.area} acres
                      </p>
                      <div className="mt-2">
                        <Badge className={`text-xs ${getStatusBadge(site.status)}`}>
                          {site.status}
                        </Badge>
                      </div>
                    </div>
                  </Link>
                ))
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
                    onBoundaryChange={(points, area) => {
                      setBoundaryPoints(points)
                      setCalculatedArea(area)
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
                      setBoundaryPoints((prev) => prev.slice(0, prev.length - 1))
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
                    {savingSite ? 'Saving…' : 'Save Site'}
                  </Button>
                </div>

                {boundaryPoints.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Points: {boundaryPoints.length} • Area:{' '}
                    {calculatedArea ? `${calculatedArea.toFixed(2)} acres` : '—'}
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

    </div>
  )
}