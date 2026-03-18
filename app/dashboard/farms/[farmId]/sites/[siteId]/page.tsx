"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import dynamic from "next/dynamic"
import { toast } from "@/hooks/use-toast"
import { getUserRole, hasPermission } from "@/lib/permissions"
import type { LeafletMapProps } from "@/app/dashboard/farms/LeafletMap"

type BoundaryPoint = { lat: number; lng: number; id: string }

interface SiteResponse {
  _id: string
  name: string
  area: number
  perimeter?: number
  slope?: number
  status?: "draft" | "submitted" | "approved" | "rejected"
  geojson?: {
    type: "Polygon"
    coordinates: [number, number][][]
  }
  notes?: string
}

// Reuse farms map in read-only mode
const LeafletMap = dynamic<LeafletMapProps>(() => import("@/app/dashboard/farms/LeafletMap"), {
  ssr: false,
  loading: () => (
    <div className="h-64 bg-gray-100 animate-pulse flex items-center justify-center rounded-lg">
      <span className="text-sm text-muted-foreground">Loading map…</span>
    </div>
  ),
})

export default function SiteDetailPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const farmId = params?.farmId as string
  const siteId = params?.siteId as string

  const [site, setSite] = useState<SiteResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editName, setEditName] = useState("")
  const [editNotes, setEditNotes] = useState("")
  const [boundary, setBoundary] = useState<BoundaryPoint[]>([])
  const [role, setRole] = useState("sales_associate")

  useEffect(() => {
    setRole(getUserRole())
  }, [])

  const statusBadgeVariant = useMemo(() => {
    const status = site?.status ?? "draft"
    switch (status) {
      case "submitted":
        return "bg-blue-100 text-blue-800"
      case "approved":
        return "bg-green-100 text-green-800"
      case "rejected":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }, [site?.status])

  const load = useCallback(async () => {
    if (!siteId) return
    setLoading(true)
    try {
      console.log("Loading site:", siteId)
      const token = typeof window !== "undefined" ? localStorage.getItem("forge_token") : null
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"
      console.log("API URL:", apiUrl)
      console.log("Token exists:", !!token)

      const response = await fetch(`${apiUrl}/api/sites/${siteId}`, {
        headers: {
          Authorization: token ? `Bearer ${token}` : "",
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
        },
      })
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      const json = await response.json()
      if (!json.success) {
        throw new Error(json.error || "Failed to load site")
      }
      const siteData: SiteResponse | undefined = json.data
      if (!siteData) {
        throw new Error("Site not found")
      }

      setSite(siteData)
      setEditName(siteData.name || "")
      setEditNotes(siteData.notes || "")

      if (siteData.geojson?.coordinates?.[0]) {
        const pts: BoundaryPoint[] = siteData.geojson.coordinates[0]
          .slice(0, -1)
          .map((c: number[], i: number) => ({
            id: `p-${i}`,
            lat: c[1],
            lng: c[0],
          }))
        setBoundary(pts)
      } else {
        setBoundary([])
      }
    } catch (err: any) {
      console.error("Site load error:", err?.message || err)
      toast({
        title: "Failed to load site",
        description: err?.message || "Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [siteId])

  useEffect(() => {
    load()
  }, [load])
  const mapCenter =
    boundary.length > 0
      ? {
          lat: boundary.reduce((s, p) => s + p.lat, 0) / boundary.length,
          lng: boundary.reduce((s, p) => s + p.lng, 0) / boundary.length,
        }
      : null

  useEffect(() => {
    // Force fresh fetch every time this page mounts/navigation changes siteId
    setLoading(true)
    load()
  }, [siteId])

  useEffect(() => {
    if (typeof window === "undefined") return
    const handleFocus = () => {
      load()
    }
    window.addEventListener("focus", handleFocus)
    return () => window.removeEventListener("focus", handleFocus)
  }, [load])

  const handleDelete = async () => {
    if (!site || !farmId) return
    if (
      typeof window !== "undefined" &&
      !window.confirm(`Delete site "${site.name}"? This action cannot be undone.`)
    ) {
      return
    }
    setDeleting(true)
    try {
      const token = localStorage.getItem("forge_token")
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"
      const res = await fetch(`${apiUrl}/api/sites/${site._id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })
      if (!res.ok) throw new Error("Failed to delete site")
      toast({ title: "Site deleted" })
      router.push(`/dashboard/farms/${farmId}/sites`)
    } catch (err) {
      console.error(err)
      toast({
        title: "Failed to delete site",
        description: "Please try again.",
        variant: "destructive",
      })
      setDeleting(false)
    }
  }

  const handleEditSave = async () => {
    if (!siteId) return
    setEditing(true)
    setSaving(true)
    try {
      const token = localStorage.getItem("forge_token")
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"
      const res = await fetch(`${apiUrl}/api/sites/${siteId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: editName.trim(),
          notes: editNotes.trim() || undefined,
        }),
      })
      if (!res.ok) throw new Error("Failed to update site")
      await load()
      toast({ title: "Site updated" })
    } catch (err) {
      console.error(err)
      toast({
        title: "Failed to update site",
        description: "Please try again.",
        variant: "destructive",
      })
    } finally {
      setEditing(false)
      setSaving(false)
    }
  }

  const handleStartEvaluation = () => {
    if (!site || !farmId) return
    const encodedSiteId = encodeURIComponent(site._id)
    const encodedFarmId = encodeURIComponent(farmId)
    router.push(`/dashboard/site-evaluations/new?siteId=${encodedSiteId}&farmId=${encodedFarmId}`)
  }

  if (!farmId || !siteId) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Invalid site.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/dashboard/farms/${farmId}/sites`}>← Sites</Link>
        </Button>
      </div>

      {loading || !site ? (
        <div>
          <h1 className="text-2xl font-semibold">Site</h1>
          <p className="text-muted-foreground text-sm mt-2">Loading site details…</p>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{site.name}</h1>
              <p className="text-muted-foreground">
                Area: {site.area} acres{" "}
                {site.perimeter != null ? `• Perimeter: ${site.perimeter} m` : ""}{" "}
                {site.slope != null ? `• Slope: ${site.slope}%` : ""}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge className={statusBadgeVariant}>{site.status ?? "draft"}</Badge>
              {hasPermission(role, "canCreateSite") && (
                <Button variant="outline" size="sm" onClick={handleStartEvaluation}>
                  Start Evaluation
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleEditSave}
                disabled={saving}
              >
                {saving ? "Saving..." : "Save Changes"}
              </Button>
              {hasPermission(role, "canDeleteSite") && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-600"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? "Deleting…" : "Delete"}
                </Button>
              )}
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] items-start">
            <Card className="overflow-hidden">
              <CardHeader>
                <CardTitle>Boundary</CardTitle>
                <CardDescription>Existing field boundary (read-only)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {boundary.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No boundary data available for this site.
                  </p>
                ) : (
                  <div className="h-80 w-full overflow-hidden rounded-lg border">
                    <LeafletMap
                      readOnly={true}
                      boundary={boundary}
                      initialBoundary={boundary}
                      initialCenter={mapCenter}
                      // Keep area from parent; ignore edits in detail page
                      onBoundaryChange={() => {}}
                      isFullscreen={false}
                      onExitFullscreen={() => {}}
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Details</CardTitle>
                <CardDescription>Edit basic site information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Name</label>
                  <input
                    type="text"
                    className="w-full rounded-md border px-3 py-2 text-sm"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Notes</label>
                  <textarea
                    className="w-full min-h-[120px] rounded-md border px-3 py-2 text-sm resize-none"
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="Add notes about this site (optional)…"
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

