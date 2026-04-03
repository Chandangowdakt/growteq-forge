"use client"
import { useState, useEffect, useRef, useCallback, FormEvent, type MutableRefObject } from "react"
import { MapContainer, TileLayer, ScaleControl, ZoomControl, useMapEvents, useMap } from "react-leaflet"
import type { LatLngExpression } from "leaflet"
import L from "leaflet"
import { polygon, area as turfArea, lineString, length as turfLength } from "@turf/turf"
import "leaflet/dist/leaflet.css"

delete (L.Icon.Default as any).prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
})

const DEFAULT_CENTER: LatLngExpression = [12.9716, 77.5946]
const DEFAULT_ZOOM = 15

type SearchSuggestion = {
  label: string
  lat: number
  lng: number
  boundingbox?: string[]
}

/** Build a readable place label from Nominatim `addressdetails=1` (falls back to display_name). */
function formatNominatimLabel(place: {
  display_name?: string
  name?: string
  address?: Record<string, string | undefined>
}): string {
  const a = place.address ?? {}
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : "")
  const parts = [
    str(place.name) || str(a.amenity) || str(a.building) || str(a.road),
    str(a.village) || str(a.suburb) || str(a.neighbourhood) || str(a.hamlet),
    str(a.town) || str(a.city) || str(a.county) || str(a.district),
    str(a.state),
    str(a.country),
  ].filter(Boolean)
  const deduped = parts.filter((p, i) => p !== parts[i - 1])
  if (deduped.length > 0) return deduped.join(", ")
  return place.display_name?.trim() || "Unknown"
}

/** Persist draw-map center/zoom so returning from other pages does not reset the view. */
const FARMS_DRAW_MAP_VIEW_KEY = "growteq-forge-farms-draw-map-view"

/** Satellite-friendly boundary styling */
const BOUNDARY_RED_ICON = new L.Icon({
  iconUrl: "https://maps.google.com/mapfiles/ms/icons/red-dot.png",
  iconSize: [32, 32],
  iconAnchor: [16, 32],
})

const PINK_POLYGON_STYLE: L.PathOptions = {
  color: "#ec4899",
  weight: 3,
  opacity: 1,
  fillColor: "#ec4899",
  fillOpacity: 0.25,
}

interface BoundaryPoint {
  lat: number
  lng: number
  id: string
}

export interface LeafletMapProps {
  boundary: BoundaryPoint[]
  onBoundaryChange: (points: BoundaryPoint[], areaAcres: number) => void
  isFullscreen: boolean
  onExitFullscreen: () => void
  readOnly?: boolean
  initialCenter?: { lat: number; lng: number } | null
  initialBoundary?: BoundaryPoint[]
}

function FlyToCenter({
  center,
  viewOnceKeyRef,
}: {
  center: { lat: number; lng: number } | null
  viewOnceKeyRef: MutableRefObject<string | null>
}) {
  const map = useMap()
  useEffect(() => {
    if (!center) return
    const key = `${center.lat},${center.lng}`
    if (viewOnceKeyRef.current === key) return
    viewOnceKeyRef.current = key
    map.setView([center.lat, center.lng], 17, { animate: false })
  }, [center?.lat, center?.lng, map, viewOnceKeyRef])
  return null
}

function ClickHandler({ onSelect }: { onSelect: (lat: number, lng: number) => void }) {
  useMapEvents({ click(e) { onSelect(e.latlng.lat, e.latlng.lng) } })
  return null
}

function LocationFlyTo({
  coords,
  skipFlyRef,
}: {
  coords: LatLngExpression | null
  skipFlyRef: MutableRefObject<boolean>
}) {
  const map = useMap()
  useEffect(() => {
    if (!coords) return
    if (skipFlyRef.current) return
    map.flyTo(coords, DEFAULT_ZOOM, { animate: true, duration: 1.5 })
  }, [coords, map, skipFlyRef])
  return null
}

function SearchFlyTo({ target }: { target: LatLngExpression | null }) {
  const map = useMap()
  useEffect(() => { if (target) map.flyTo(target, 17, { animate: true, duration: 1.5 }) }, [target, map])
  return null
}

function MapResizer({ isFullscreen }: { isFullscreen: boolean }) {
  const map = useMap()
  useEffect(() => {
    const id = window.setTimeout(() => map.invalidateSize(), 200)
    return () => window.clearTimeout(id)
  }, [isFullscreen, map])
  return null
}

/** Imperative boundary layers — avoids react-leaflet Marker/Polygon sync issues (_leaflet_pos, duplicate layers). */
function BoundaryLayers({
  points,
  fitBoundsOnChange,
}: {
  points: BoundaryPoint[]
  /** When false (interactive draw), do not fitBounds on each new point — prevents map jump. */
  fitBoundsOnChange: boolean
}) {
  const map = useMap()
  const polygonRef = useRef<L.Polygon | null>(null)
  const markersRef = useRef<L.Marker[]>([])

  const coordsSig = points.map((p) => `${p.lat},${p.lng}`).join(";")

  useEffect(() => {
    if (!map) return

    const clearBoundaryLayers = () => {
      if (polygonRef.current) {
        try {
          if (map.hasLayer(polygonRef.current)) map.removeLayer(polygonRef.current)
        } catch {
          /* stale layer */
        }
        polygonRef.current = null
      }
      markersRef.current.forEach((m) => {
        try {
          if (map.hasLayer(m)) map.removeLayer(m)
        } catch {
          /* ignore */
        }
      })
      markersRef.current = []
    }

    clearBoundaryLayers()

    points.forEach((p) => {
      const marker = L.marker([p.lat, p.lng], { icon: BOUNDARY_RED_ICON }).addTo(map)
      markersRef.current.push(marker)
    })

    if (fitBoundsOnChange) {
      if (points.length >= 3) {
        const latlngs = points.map((p) => [p.lat, p.lng] as L.LatLngTuple)
        const poly = L.polygon(latlngs, PINK_POLYGON_STYLE).addTo(map)
        poly.on("mouseover", () => poly.setStyle({ weight: 4 }))
        poly.on("mouseout", () => poly.setStyle(PINK_POLYGON_STYLE))
        polygonRef.current = poly
        try {
          map.fitBounds(poly.getBounds(), { padding: [24, 24], maxZoom: 19, animate: false })
        } catch {
          /* invalid bounds */
        }
      } else if (points.length >= 2) {
        const lats = points.map((p) => p.lat)
        const lngs = points.map((p) => p.lng)
        const bounds: L.LatLngBoundsExpression = [
          [Math.min(...lats), Math.min(...lngs)],
          [Math.max(...lats), Math.max(...lngs)],
        ]
        try {
          map.fitBounds(bounds, { padding: [40, 40], maxZoom: 19, animate: false })
        } catch {
          /* ignore */
        }
      }
    } else if (points.length >= 3) {
      const latlngs = points.map((p) => [p.lat, p.lng] as L.LatLngTuple)
      const poly = L.polygon(latlngs, PINK_POLYGON_STYLE).addTo(map)
      poly.on("mouseover", () => poly.setStyle({ weight: 4 }))
      poly.on("mouseout", () => poly.setStyle(PINK_POLYGON_STYLE))
      polygonRef.current = poly
    }

    return () => {
      try {
        clearBoundaryLayers()
      } catch {
        /* map may be tearing down */
      }
    }
  }, [map, coordsSig, fitBoundsOnChange])

  return null
}

/** Restore/save draw-map view (non–read-only only). Runs before LocationFlyTo so geolocation can be skipped when restored. */
function DrawMapViewSession({
  readOnly,
  locating,
  onRestoredFromSession,
}: {
  readOnly?: boolean
  locating: boolean
  onRestoredFromSession: () => void
}) {
  const map = useMap()
  const restoredRef = useRef(false)

  useEffect(() => {
    if (readOnly || locating || restoredRef.current) return
    try {
      const raw = sessionStorage.getItem(FARMS_DRAW_MAP_VIEW_KEY)
      if (!raw) return
      const o = JSON.parse(raw) as { lat?: number; lng?: number; zoom?: number }
      if (
        typeof o.lat === "number" &&
        typeof o.lng === "number" &&
        Number.isFinite(o.lat) &&
        Number.isFinite(o.lng) &&
        typeof o.zoom === "number" &&
        Number.isFinite(o.zoom)
      ) {
        map.setView([o.lat, o.lng], o.zoom, { animate: false })
        restoredRef.current = true
        onRestoredFromSession()
      }
    } catch {
      /* ignore */
    }
  }, [map, readOnly, locating, onRestoredFromSession])

  useEffect(() => {
    if (readOnly) return
    const save = () => {
      try {
        const c = map.getCenter()
        sessionStorage.setItem(
          FARMS_DRAW_MAP_VIEW_KEY,
          JSON.stringify({ lat: c.lat, lng: c.lng, zoom: map.getZoom() })
        )
      } catch {
        /* ignore */
      }
    }
    map.on("moveend", save)
    return () => {
      map.off("moveend", save)
    }
  }, [map, readOnly])

  return null
}

export default function LeafletMap({
  boundary,
  onBoundaryChange,
  isFullscreen,
  onExitFullscreen,
  readOnly,
  initialCenter,
  initialBoundary,
}: LeafletMapProps) {
  const [boundaryPoints, setBoundaryPoints] = useState<BoundaryPoint[]>(boundary)
  const [currentLocation, setCurrentLocation] = useState<LatLngExpression | null>(null)
  const [locating, setLocating] = useState(true)
  const lastClickRef = useRef<number | null>(null)
  const [coordValue, setCoordValue] = useState("")
  const [searchTarget, setSearchTarget] = useState<LatLngExpression | null>(null)
  const [mapMode, setMapMode] = useState<"draw" | "walk">("draw")

  // Location search state
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<SearchSuggestion[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [searching, setSearching] = useState(false)
  const searchTimeoutRef = useRef<number | null>(null)
  const searchBoxRef = useRef<HTMLDivElement | null>(null)

  // Walk mode state
  const [walkPoints, setWalkPoints] = useState<{ lat: number; lng: number }[]>([])
  const [walkState, setWalkState] = useState<"idle" | "walking" | "paused" | "finished">("idle")
  const watchIdRef = useRef<number | null>(null)
  const walkLayerRef = useRef<L.LayerGroup | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const onBoundaryChangeRef = useRef(onBoundaryChange)
  const skipGeolocationFlyRef = useRef(false)
  const flyToCenterKeyRef = useRef<string | null>(null)
  const boundaryPropSigRef = useRef<string>("")

  const onSessionViewRestored = useCallback(() => {
    skipGeolocationFlyRef.current = true
  }, [])

  useEffect(() => {
    onBoundaryChangeRef.current = onBoundaryChange
  }, [onBoundaryChange])

  useEffect(() => {
    if (readOnly) {
      setLocating(false)
      return
    }
    // Only locate user for new site creation (no saved boundary)
    if (!navigator.geolocation) {
      setLocating(false)
      return
    }
    if (initialBoundary && initialBoundary.length > 0) {
      setLocating(false)
      return
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCurrentLocation([pos.coords.latitude, pos.coords.longitude])
        setLocating(false)
      },
      () => setLocating(false),
      { timeout: 8000 }
    )
  }, [readOnly, initialBoundary?.length])

  useEffect(() => {
    const sig = boundary.map((p) => `${p.lat},${p.lng},${p.id}`).join("|")
    if (sig === boundaryPropSigRef.current) return
    boundaryPropSigRef.current = sig
    setBoundaryPoints(boundary)
  }, [boundary])

  useEffect(() => {
    if (!isFullscreen) return
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") onExitFullscreen() }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isFullscreen, onExitFullscreen])

  useEffect(() => {
    if (typeof document === "undefined") return
    const previous = document.body.style.overflow
    document.body.style.overflow = isFullscreen ? "hidden" : "auto"
    return () => { document.body.style.overflow = previous }
  }, [isFullscreen])

  // Cleanup geolocation watch on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
    }
  }, [])

  // Reset drawing and walking state when mode changes (never clear saved boundary in read-only)
  useEffect(() => {
    if (readOnly) return
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    setWalkPoints([])
    setWalkState("idle")
    if (walkLayerRef.current) {
      walkLayerRef.current.clearLayers()
    }
    setBoundaryPoints([])
    onBoundaryChangeRef.current?.([], 0)
  }, [mapMode, readOnly])

  // Debounced Nominatim search (Usage Policy: https://operations.osmfoundation.org/policies/nominatim/)
  useEffect(() => {
    const q = searchQuery.trim()
    if (q.length < 3) {
      setSearchResults([])
      setShowDropdown(false)
      setSearching(false)
      if (searchTimeoutRef.current != null) {
        window.clearTimeout(searchTimeoutRef.current)
        searchTimeoutRef.current = null
      }
      return
    }

    if (searchTimeoutRef.current != null) {
      window.clearTimeout(searchTimeoutRef.current)
    }
    searchTimeoutRef.current = window.setTimeout(async () => {
      setSearching(true)
      try {
        const searchUrl = new URL("https://nominatim.openstreetmap.org/search")
        searchUrl.searchParams.set("q", q)
        searchUrl.searchParams.set("format", "json")
        searchUrl.searchParams.set("addressdetails", "1")
        searchUrl.searchParams.set("limit", "8")
        searchUrl.searchParams.set("dedupe", "1")
        searchUrl.searchParams.set("featuretype", "settlement")
        searchUrl.searchParams.set("viewbox", "68.1,37.1,97.4,8.0")
        searchUrl.searchParams.set("bounded", "0")

        const res = await fetch(searchUrl.toString(), {
          headers: { "Accept-Language": "en" },
        })
        if (!res.ok) {
          setSearchResults([])
          setShowDropdown(false)
          return
        }
        const data = (await res.json()) as Array<{
          lat: string
          lon: string
          display_name?: string
          name?: string
          address?: Record<string, string | undefined>
          boundingbox?: string[]
        }>
        const suggestions: SearchSuggestion[] = data.map((place) => ({
          label: formatNominatimLabel(place),
          lat: parseFloat(place.lat),
          lng: parseFloat(place.lon),
          boundingbox: place.boundingbox,
        })).filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng))
        setSearchResults(suggestions)
        setShowDropdown(suggestions.length > 0)
      } catch {
        setSearchResults([])
        setShowDropdown(false)
      } finally {
        setSearching(false)
      }
    }, 400)

    return () => {
      if (searchTimeoutRef.current != null) {
        window.clearTimeout(searchTimeoutRef.current)
        searchTimeoutRef.current = null
      }
    }
  }, [searchQuery])

  // Close dropdown on outside click
  useEffect(() => {
    if (typeof document === "undefined") return
    const handler = (e: MouseEvent) => {
      if (!searchBoxRef.current) return
      if (!searchBoxRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener("click", handler)
    return () => document.removeEventListener("click", handler)
  }, [])

  const computeArea = (points: BoundaryPoint[]): number => {
    if (points.length < 3) return 0
    const coords = points.map((p) => [p.lng, p.lat])
    coords.push(coords[0])
    return Number((turfArea(polygon([coords])) / 4046.8564224).toFixed(2))
  }

  const computePerimeter = (points: BoundaryPoint[]): number => {
    if (points.length < 2) return 0
    const coords = points.map((p) => [p.lng, p.lat])
    coords.push(coords[0])
    return Number((turfLength(lineString(coords), { units: "kilometers" }) * 1000).toFixed(2))
  }

  const handleSelect = (lat: number, lng: number) => {
    if (readOnly) return
    if (mapMode !== "draw") return
    const now = Date.now()
    if (lastClickRef.current && now - lastClickRef.current < 300) return
    lastClickRef.current = now
    if (boundaryPoints.length >= 10) return
    const point: BoundaryPoint = { lat, lng, id: `p-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` }
    setBoundaryPoints((prev) => {
      const updated = [...prev, point]
      const area = computeArea(updated)
      onBoundaryChangeRef.current?.(updated, area)
      return updated
    })
  }

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault()
    const [latStr, lngStr] = coordValue.trim().split(",")
    const lat = parseFloat(latStr), lng = parseFloat(lngStr)
    if (Number.isFinite(lat) && Number.isFinite(lng)) setSearchTarget([lat, lng])
  }

  const distanceMeters = (() => {
    if (walkPoints.length < 2) return 0
    let total = 0
    for (let i = 1; i < walkPoints.length; i++) {
      const prev = walkPoints[i - 1]
      const pt = walkPoints[i]
      const line = lineString([
        [prev.lng, prev.lat],
        [pt.lng, pt.lat],
      ])
      total += turfLength(line, { units: "kilometers" }) * 1000
    }
    return total
  })()

  const walkAreaAcres = (() => {
    if (walkPoints.length < 3) return 0
    const closed = [...walkPoints, walkPoints[0]]
    const coords = closed.map((p) => [p.lng, p.lat])
    return Number((turfArea(polygon([coords])) / 4046.8564224).toFixed(2))
  })()

  const ensureWalkLayer = () => {
    if (!mapRef.current) return
    if (!walkLayerRef.current) {
      walkLayerRef.current = L.layerGroup().addTo(mapRef.current)
    }
    walkLayerRef.current.clearLayers()
  }

  const renderWalkPath = (points: { lat: number; lng: number }[]) => {
    if (!mapRef.current || points.length === 0) return
    ensureWalkLayer()
    if (!walkLayerRef.current) return
    const latLngs = points.map((p) => [p.lat, p.lng]) as [number, number][]
    L.polyline(latLngs, {
      color: "#ec4899",
      weight: 3,
      dashArray: "6 4",
      opacity: 0.9,
    }).addTo(walkLayerRef.current)
    for (const p of points) {
      L.marker([p.lat, p.lng], { icon: BOUNDARY_RED_ICON }).addTo(walkLayerRef.current)
    }
  }

  const startWalk = () => {
    if (readOnly) return
    if (walkState === "walking") return
    if (!navigator.geolocation) {
      alert("GPS not available")
      return
    }
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const pt = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setWalkPoints((prev) => {
          const next = [...prev, pt]
          renderWalkPath(next)
          if (mapRef.current) {
            mapRef.current.panTo([pt.lat, pt.lng])
          }
          return next
        })
      },
      (err) => {
        console.warn("GPS error:", err)
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    )
    watchIdRef.current = watchId
    setWalkState("walking")
  }

  const pauseWalk = () => {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    if (walkState === "walking") {
      setWalkState("paused")
    }
  }

  const finishWalk = () => {
    pauseWalk()
    if (readOnly) return
    if (walkPoints.length < 3) {
      alert("Need at least 3 points to calculate area.")
      return
    }
    if (walkLayerRef.current) {
      walkLayerRef.current.clearLayers()
    }
    const boundaryFromWalk: BoundaryPoint[] = walkPoints.map((p, idx) => ({
      lat: p.lat,
      lng: p.lng,
      id: `w-${idx}`,
    }))
    setBoundaryPoints(boundaryFromWalk)
    const area = walkAreaAcres
    onBoundaryChangeRef.current?.(boundaryFromWalk, area)
    setWalkState("finished")
  }

  return (
    <div className={isFullscreen ? "fixed inset-0 z-[9999] bg-black transition-all duration-200" : "relative h-full w-full"}>
      {locating && (
        <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-white/70 rounded-lg">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Locating you...
          </div>
        </div>
      )}

      <MapContainer
        ref={mapRef}
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        maxZoom={22}
        minZoom={3}
        zoomSnap={0.25}
        zoomDelta={0.5}
        style={{ height: "100%", width: "100%", cursor: "crosshair" }}
        scrollWheelZoom
        zoomControl={false}
      >
        {(() => {
          const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
          return token ? (
            <TileLayer
              attribution="© Mapbox © OpenStreetMap"
              url={`https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/{z}/{x}/{y}?access_token=${token}`}
              maxZoom={22}
              tileSize={512}
              zoomOffset={-1}
            />
          ) : (
            <TileLayer
              attribution="Tiles © Esri"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              maxZoom={22}
            />
          )
        })()}

        {!readOnly && (
          <DrawMapViewSession
            readOnly={readOnly}
            locating={locating}
            onRestoredFromSession={onSessionViewRestored}
          />
        )}
        {!readOnly && <ClickHandler onSelect={handleSelect} />}
        <LocationFlyTo coords={currentLocation} skipFlyRef={skipGeolocationFlyRef} />
        <SearchFlyTo target={searchTarget} />
        <MapResizer isFullscreen={isFullscreen} />
        <FlyToCenter center={initialCenter ?? null} viewOnceKeyRef={flyToCenterKeyRef} />
        <BoundaryLayers points={boundaryPoints} fitBoundsOnChange={!!readOnly} />
        <ScaleControl position="bottomleft" />
        <ZoomControl position="bottomleft" />
      </MapContainer>

      {isFullscreen && (
        <button type="button" onClick={onExitFullscreen}
          className="absolute top-4 right-4 z-[10000] bg-white text-black px-4 py-2 rounded-lg shadow-md">
          Exit Fullscreen
        </button>
      )}

      {isFullscreen && !readOnly && (
        <div
          style={{
            position: "absolute",
            bottom: "20px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1000,
            display: "flex",
            gap: "8px",
          }}
        >
          <button
            onClick={() => {
              if (boundaryPoints.length === 0) return
              setBoundaryPoints((prev) => {
                const updated = prev.slice(0, -1)
                const area = computeArea(updated)
                onBoundaryChangeRef.current?.(updated, area)
                return updated
              })
            }}
            style={{
              background: "white",
              border: "1px solid #ccc",
              borderRadius: "6px",
              padding: "8px 16px",
              cursor: "pointer",
              fontSize: "13px",
              boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
            }}
          >
            Undo Last Point
          </button>
          <button
            onClick={() => {
              setBoundaryPoints([])
              onBoundaryChangeRef.current?.([], 0)
            }}
            style={{
              background: "white",
              border: "1px solid #ccc",
              borderRadius: "6px",
              padding: "8px 16px",
              cursor: "pointer",
              fontSize: "13px",
              boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
            }}
          >
            Clear All Points
          </button>
        </div>
      )}

      <div className="pointer-events-none absolute left-4 top-4 z-[1000] space-y-2">
        <div
          ref={searchBoxRef}
          className="pointer-events-auto w-64 rounded-lg bg-white/95 px-3 py-2 shadow-sm border border-gray-200"
        >
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search village, district, city..."
              className="w-full border-none bg-transparent pr-16 text-xs outline-none focus:ring-0"
            />
            {searching && searchQuery.trim().length >= 3 && (
              <span className="pointer-events-none absolute right-0 top-1/2 max-w-[4.5rem] -translate-y-1/2 truncate text-[10px] text-gray-400">
                Searching…
              </span>
            )}
          </div>
          {showDropdown && searchResults.length > 0 && (
            <div className="mt-2 max-h-40 w-full overflow-y-auto rounded-md border bg-white text-xs shadow-lg">
              {searchResults.map((r, idx) => (
                <button
                  key={`${r.label}-${r.lat}-${r.lng}-${idx}`}
                  type="button"
                  className="block w-full px-2 py-1 text-left hover:bg-gray-100"
                  onClick={() => {
                    const map = mapRef.current
                    if (r.boundingbox && r.boundingbox.length >= 4 && map) {
                      const [minLat, maxLat, minLon, maxLon] = r.boundingbox.map((v) => parseFloat(v))
                      if (
                        Number.isFinite(minLat) &&
                        Number.isFinite(maxLat) &&
                        Number.isFinite(minLon) &&
                        Number.isFinite(maxLon)
                      ) {
                        map.fitBounds(
                          [
                            [minLat, minLon],
                            [maxLat, maxLon],
                          ],
                          { maxZoom: 17, padding: [20, 20] }
                        )
                      } else if (Number.isFinite(r.lat) && Number.isFinite(r.lng)) {
                        map.flyTo([r.lat, r.lng], 16, { animate: true, duration: 1.2 })
                      }
                    } else if (map && Number.isFinite(r.lat) && Number.isFinite(r.lng)) {
                      map.flyTo([r.lat, r.lng], 16, { animate: true, duration: 1.2 })
                    } else if (Number.isFinite(r.lat) && Number.isFinite(r.lng)) {
                      setSearchTarget([r.lat, r.lng])
                    }
                    setSearchQuery(r.label)
                    setShowDropdown(false)
                    setSearchResults([])
                  }}
                >
                  {r.label.length > 72 ? `${r.label.slice(0, 69)}…` : r.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <form
          onSubmit={handleSearchSubmit}
          className="pointer-events-auto flex items-center gap-2 rounded-full bg-white/90 px-3 py-1 shadow-sm"
        >
          <input
            type="text"
            value={coordValue}
            onChange={(e) => setCoordValue(e.target.value)}
            placeholder="12.9716,77.5946"
            className="w-40 border-none bg-transparent text-xs outline-none"
          />
          <button
            type="submit"
            className="rounded-full bg-[#387F43] px-2 py-1 text-[10px] font-medium text-white"
          >
            Go
          </button>
        </form>

        <div className="pointer-events-auto mt-1 inline-flex rounded-full bg-white/90 p-1 text-[10px] shadow-sm">
          <button
            type="button"
            className={`px-3 py-1 rounded-full ${
              mapMode === "draw"
                ? "bg-[#387F43] text-white"
                : "bg-transparent text-gray-700 border border-gray-200"
            }`}
            onClick={() => setMapMode("draw")}
          >
            Draw Boundary
          </button>
          <button
            type="button"
            className={`ml-1 px-3 py-1 rounded-full ${
              mapMode === "walk"
                ? "bg-[#387F43] text-white"
                : "bg-transparent text-gray-700 border border-gray-200"
            }`}
            onClick={() => setMapMode("walk")}
          >
            Walk Mode
          </button>
        </div>
      </div>

      <div className="pointer-events-none absolute right-4 bottom-4 z-[1000]">
        {mapMode === "draw" ? (() => {
          const areaAcres = computeArea(boundaryPoints)
          const perimeterMeters = computePerimeter(boundaryPoints)
          const areaSqm = areaAcres > 0 ? areaAcres * 4047 : 0
          const isValidPolygon = boundaryPoints.length >= 3 && areaAcres > 0.001
          return (
            <div className="pointer-events-auto rounded-xl bg-white/90 px-3 py-2 text-xs shadow-sm space-y-1">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Points</span>
                <span className="font-medium">{boundaryPoints.length}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Area</span>
                <span className="font-medium">
                  {areaAcres ? `${areaAcres} acres` : "—"}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Area (m²)</span>
                <span className="font-medium">
                  {areaSqm
                    ? `${Math.round(areaSqm).toLocaleString("en-IN")} m²`
                    : "—"}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Perimeter</span>
                <span className="font-medium">
                  {perimeterMeters ? `${perimeterMeters} meters` : "—"}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Slope</span>
                <span className="font-medium">2.5%</span>
              </div>
              {!isValidPolygon && boundaryPoints.length >= 3 && (
                <div className="text-orange-500 text-xs mt-1">
                  ⚠️ Points may be collinear — area too small
                </div>
              )}
              {areaAcres > 1000 && (
                <div className="text-orange-500 text-xs mt-1">
                  ⚠️ Very large boundary — verify coordinates
                </div>
              )}
            </div>
          )
        })() : (
          <div className="pointer-events-auto space-y-2">
            <div className="rounded-xl bg-white/90 px-3 py-2 text-xs shadow-sm space-y-1">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Points</span>
                <span className="font-medium">{walkPoints.length}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Distance</span>
                <span className="font-medium">
                  {distanceMeters ? `${distanceMeters.toFixed(0)} m` : "—"}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Area</span>
                <span className="font-medium">
                  {walkAreaAcres ? `${walkAreaAcres.toFixed(2)} acres` : "—"}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Slope</span>
                <span className="font-medium">2.5%</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 justify-end text-[10px]">
              {walkState === "idle" && (
                <button
                  type="button"
                  className="pointer-events-auto rounded-full bg-[#387F43] px-3 py-1 font-medium text-white"
                  onClick={startWalk}
                >
                  Start Walk
                </button>
              )}
              {walkState === "walking" && (
                <>
                  <button
                    type="button"
                    className="pointer-events-auto rounded-full bg-gray-100 px-3 py-1 font-medium text-gray-800 border border-gray-300"
                    onClick={pauseWalk}
                  >
                    Pause Walk
                  </button>
                  <button
                    type="button"
                    className="pointer-events-auto rounded-full bg-[#387F43] px-3 py-1 font-medium text-white"
                    onClick={finishWalk}
                  >
                    Finish Walk
                  </button>
                </>
              )}
              {walkState === "paused" && (
                <>
                  <button
                    type="button"
                    className="pointer-events-auto rounded-full bg-[#387F43] px-3 py-1 font-medium text-white"
                    onClick={startWalk}
                  >
                    Resume Walk
                  </button>
                  <button
                    type="button"
                    className="pointer-events-auto rounded-full bg-red-600 px-3 py-1 font-medium text-white"
                    onClick={finishWalk}
                  >
                    Finish Walk
                  </button>
                </>
              )}
              {walkState === "finished" && (
                <span className="pointer-events-auto rounded-full bg-emerald-100 px-3 py-1 font-medium text-emerald-800">
                  Walk completed — save site from Farms panel
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}