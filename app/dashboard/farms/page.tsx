'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
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
import { InteractiveMap } from '@/components/map/interactive-map'
import { LandPolygon } from '@/lib/map-provider'
import { MapPin, CheckCircle, Clock, AlertCircle } from 'lucide-react'
import { siteEvaluationsApi, farmsApi, type SiteEvaluation, type Farm } from '@/lib/api'
import { formatDistanceToNow } from 'date-fns'
import { toast } from '@/hooks/use-toast'
import { CreateFarmModal } from './CreateFarmModal'

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
  const [savedPolygons, setSavedPolygons] = useState<LandPolygon[]>([])
  const [currentPolygon, setCurrentPolygon] = useState<LandPolygon | null>(null)
  const [activeSites, setActiveSites] = useState<ActiveSite[]>([])
  const [loading, setLoading] = useState(true)
  const [farms, setFarms] = useState<Farm[]>([])
  const [selectedFarmId, setSelectedFarmId] = useState<string | null>(null)
  const [createFarmOpen, setCreateFarmOpen] = useState(false)
  const [farmsLoading, setFarmsLoading] = useState(true)

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

  const handlePolygonComplete = async (polygon: LandPolygon) => {
    if (!selectedFarmId) {
      toast({
        title: 'Select a farm first',
        description: 'Choose a farm from the dropdown above before creating a site evaluation.',
        variant: 'destructive',
      })
      return
    }
    setSavedPolygons((prev) => [...prev, polygon])
    const areaAcres = polygon.properties?.area
      ? (polygon.properties.area / 4046.86)
      : 0
    try {
      await siteEvaluationsApi.create({
        name: polygon.properties?.name ?? `Site ${new Date().toLocaleDateString()}`,
        area: areaAcres,
        areaUnit: 'acres',
        boundary: polygon.points,
        status: 'draft',
        farmId: selectedFarmId,
      })
      toast({ title: 'Site evaluation created' })
      fetchSites()
    } catch {
      toast({
        title: 'Failed to create site evaluation',
        description: 'Please try again.',
        variant: 'destructive',
      })
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
          <p className="text-muted-foreground">Google Maps-based site evaluation and land boundary marking</p>
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
          <Button className="bg-[#387F43] hover:bg-[#2d6535]">+ New Site</Button>
        </div>
      </div>
      {!selectedFarmId && (
        <p className="text-sm text-muted-foreground">
          Select a farm to create and filter site evaluations.
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left sidebar - Site list */}
        <div className="lg:col-span-1">
          <Card className="h-full">
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
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{site.name}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          <MapPin className="h-3 w-3 inline mr-1" />
                          {site.area} acres
                        </p>
                        <p className="text-xs text-muted-foreground">{site.lastMarked}</p>
                      </div>
                      <div className="flex-shrink-0">{getStatusIcon(site.status)}</div>
                    </div>
                    <div className="mt-2">
                      <Badge className={`text-xs ${getStatusBadge(site.status)}`}>{site.status}</Badge>
                    </div>
                  </div>
                </Link>
              )))}
              <Button variant="outline" className="w-full mt-4 bg-transparent" onClick={fetchSites}>
                Refresh sites
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right content - Map and details */}
        <div className="lg:col-span-3 space-y-6">
          <InteractiveMap
            onPolygonComplete={handlePolygonComplete}
            onPolygonChange={setCurrentPolygon}
            savedPolygons={savedPolygons}
          />

          {/* Saved polygons list */}
          {savedPolygons.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Saved Site Boundaries</CardTitle>
                <CardDescription>{savedPolygons.length} boundary polygons marked</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {savedPolygons.map((polygon) => (
                    <div key={polygon.id} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{polygon.properties.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {polygon.properties.area && (
                              <>
                                {Math.round((polygon.properties.area / 4047.86) * 100) / 100} acres •{' '}
                              </>
                            )}
                            {polygon.points.length} points
                          </p>
                        </div>
                        <Button size="sm" variant="outline">
                          Edit
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
