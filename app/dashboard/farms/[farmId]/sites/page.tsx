"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { farmsApi } from "@/lib/api"
import { Sprout } from "lucide-react"

interface SiteItem {
  _id: string
  name: string
  area: number
  perimeter?: number
}

export default function FarmSitesPage() {
  const params = useParams()
  const farmId = params?.farmId as string
  const [sites, setSites] = useState<SiteItem[]>([])
  const [farm, setFarm] = useState<{ name: string } | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    if (!farmId) return
    setLoading(true)
    try {
      const [farmRes, sitesRes] = await Promise.all([
        farmsApi.getById(farmId),
        farmsApi.getSites(farmId),
      ])
      if (farmRes?.data) setFarm(farmRes.data)
      if (sitesRes?.success && sitesRes.data) setSites(sitesRes.data)
    } catch {
      setSites([])
    } finally {
      setLoading(false)
    }
  }, [farmId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (!farmId) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Invalid farm.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/farms">← Farms</Link>
        </Button>
      </div>
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Sites {farm ? `— ${farm.name}` : ""}
        </h1>
        <p className="text-muted-foreground">Sites belonging to this farm</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Sites</CardTitle>
          <CardDescription>{sites.length} site(s)</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : sites.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center rounded-xl border border-dashed border-muted-foreground/20 bg-muted/20">
              <Sprout className="h-11 w-11 text-muted-foreground/45 mb-3" />
              <p className="text-sm font-medium text-foreground">No sites in this farm</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                Create sites from the map on the Farms page.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {sites.map((site) => (
                <li
                  key={site._id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <p className="font-medium">{site.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Area: {site.area} acres
                      {site.perimeter != null ? ` • Perimeter: ${site.perimeter} m` : ""}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/dashboard/farms/${farmId}/sites/${site._id}`}>View</Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
