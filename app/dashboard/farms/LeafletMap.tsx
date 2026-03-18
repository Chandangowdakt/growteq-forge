"use client"
import { useState, useEffect, useRef, FormEvent } from "react"
import { MapContainer, TileLayer, Marker, Polygon, ScaleControl, ZoomControl, useMapEvents, useMap } from "react-leaflet"
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

interface BoundaryPoint {
  lat: number
  lng: number
  id: string
}

interface LeafletMapProps {
  boundary: BoundaryPoint[]
  onBoundaryChange: (points: BoundaryPoint[], areaAcres: number) => void
  isFullscreen: boolean
  onExitFullscreen: () => void
  readOnly?: boolean
  initialCenter?: { lat: number; lng: number } | null
  initialBoundary?: BoundaryPoint[]
}

function FlyToCenter({ center }: { center: { lat: number; lng: number } | null }) {
  const map = useMap()
  useEffect(() => {
    if (center) {
      map.setView([center.lat, center.lng], 17, { animate: false })
    }
  }, [center?.lat, center?.lng, map])
  return null
}

function ClickHandler({ onSelect }: { onSelect: (lat: number, lng: number) => void }) {
  useMapEvents({ click(e) { onSelect(e.latlng.lat, e.latlng.lng) } })
  return null
}

function LocationFlyTo({ coords }: { coords: LatLngExpression | null }) {
  const map = useMap()
  useEffect(() => { if (coords) map.flyTo(coords, DEFAULT_ZOOM, { animate: true, duration: 1.5 }) }, [coords, map])
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

function FitToBounds({ points }: { points: BoundaryPoint[] }) {
  const map = useMap()
  useEffect(() => {
    if (points.length < 3) return
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]))
    map.fitBounds(bounds, { padding: [24, 24] })
  }, [points, map])
  return null
}

function FitBounds({ points }: { points: { lat: number; lng: number }[] }) {
  const map = useMap()

  useEffect(() => {
    if (points && points.length >= 2) {
      const lats = points.map((p) => p.lat)
      const lngs = points.map((p) => p.lng)
      const bounds: L.LatLngBoundsExpression = [
        [Math.min(...lats), Math.min(...lngs)],
        [Math.max(...lats), Math.max(...lngs)],
      ]
      map.fitBounds(bounds, {
        padding: [40, 40],
        animate: false,
        maxZoom: 19,
      })
    }
  }, [points.length])

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
  const [searchResults, setSearchResults] = useState<{ display_name: string; lat: string; lon: string }[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const searchTimeoutRef = useRef<number | null>(null)
  const searchBoxRef = useRef<HTMLDivElement | null>(null)

  // Walk mode state
  const [walkPoints, setWalkPoints] = useState<{ lat: number; lng: number }[]>([])
  const [walkState, setWalkState] = useState<"idle" | "walking" | "paused" | "finished">("idle")
  const watchIdRef = useRef<number | null>(null)
  const walkLayerRef = useRef<L.LayerGroup | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const onBoundaryChangeRef = useRef(onBoundaryChange)

  useEffect(() => {
    onBoundaryChangeRef.current = onBoundaryChange
  }, [onBoundaryChange])

  useEffect(() => {
    if (initialCenter && mapRef.current) {
      mapRef.current.setView([initialCenter.lat, initialCenter.lng], 16)
    }
  }, [initialCenter])

  useEffect(() => {
    // Only locate user for new site creation (no saved boundary / not read-only)
    if (!navigator.geolocation) {
      setLocating(false)
      return
    }
    if (readOnly || (initialBoundary && initialBoundary.length > 0)) {
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
  }, [initialBoundary?.length])

  useEffect(() => { setBoundaryPoints(boundary) }, [boundary])

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

  // Reset drawing and walking state when mode changes
  useEffect(() => {
    // Stop any active watch
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
  }, [mapMode])

  // Debounced Nominatim search
  useEffect(() => {
    if (!searchQuery || searchQuery.length < 3) {
      setSearchResults([])
      setShowDropdown(false)
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
      try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
          searchQuery
        )}&format=json&limit=5&countrycodes=in`
        const res = await fetch(url, { headers: { "Accept-Language": "en" } })
        if (!res.ok) return
        const data = (await res.json()) as { display_name: string; lat: string; lon: string }[]
        setSearchResults(data)
        setShowDropdown(data.length > 0)
      } catch {
        // ignore search errors
      }
    }, 500)

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
      color: "#3b82f6",
      weight: 2,
      dashArray: "6 4",
    }).addTo(walkLayerRef.current)
    for (const p of points) {
      L.circleMarker([p.lat, p.lng], {
        radius: 4,
        color: "#3b82f6",
        weight: 2,
        fillColor: "#3b82f6",
        fillOpacity: 0.9,
      }).addTo(walkLayerRef.current)
    }
  }

  const renderWalkPolygon = (closed: { lat: number; lng: number }[]) => {
    if (!mapRef.current || closed.length < 3) return
    ensureWalkLayer()
    if (!walkLayerRef.current) return
    const latLngs = closed.map((p) => [p.lat, p.lng]) as [number, number][]
    L.polygon(latLngs, {
      color: "#16a34a",
      weight: 2,
      opacity: 1,
      fillColor: "#22c55e",
      fillOpacity: 0.2,
    }).addTo(walkLayerRef.current)
  }

  const startWalk = () => {
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
    if (walkPoints.length < 3) {
      alert("Need at least 3 points to calculate area.")
      return
    }
    const closed = [...walkPoints, walkPoints[0]]
    renderWalkPolygon(closed)
    // Update drawing state so Save Site works with walked polygon
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

  const firstPointIcon = L.divIcon({
    html: `<svg width="24" height="36" viewBox="0 0 24 36" xmlns="http://www.w3.org/2000/svg">
             <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z" 
                   fill="#ef4444" stroke="white" stroke-width="1"/>
             <circle cx="12" cy="12" r="4" fill="white"/>
           </svg>`,
    iconSize: [24, 36] as L.PointExpression,
    iconAnchor: [12, 36] as L.PointExpression,
    popupAnchor: [0, -36] as L.PointExpression,
    className: "",
  })

  const otherPointIcon = L.divIcon({
    html: `<svg width="14" height="14" viewBox="0 0 14 14" xmlns="http://www.w3.org/2000/svg">
             <circle cx="7" cy="7" r="5" 
                     fill="#3b82f6" 
                     stroke="white" 
                     stroke-width="2"/>
           </svg>`,
    iconSize: [14, 14] as L.PointExpression,
    iconAnchor: [7, 7] as L.PointExpression,
    className: "",
  })

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

        <ClickHandler onSelect={handleSelect} />
        <LocationFlyTo coords={currentLocation} />
        <SearchFlyTo target={searchTarget} />
        <MapResizer isFullscreen={isFullscreen} />
        <FitToBounds points={boundaryPoints} />
        <FitBounds points={boundaryPoints} />
        <FlyToCenter center={initialCenter ?? null} />
        <ScaleControl position="bottomleft" />
        <ZoomControl position="bottomleft" />

        {boundaryPoints.map((point, index) => (
          <Marker
            key={point.id}
            position={[point.lat, point.lng]}
            icon={firstPointIcon}
          />
        ))}

        {boundaryPoints.length >= 3 && (
          <Polygon
            positions={boundary}
            pathOptions={{
              color: "#16a34a",
              weight: 2,
              opacity: 1,
              fillColor: "#22c55e",
              fillOpacity: 0.2,
            }}
          />
        )}
      </MapContainer>

      {isFullscreen && (
        <button type="button" onClick={onExitFullscreen}
          className="absolute top-4 right-4 z-[10000] bg-white text-black px-4 py-2 rounded-lg shadow-md">
          Exit Fullscreen
        </button>
      )}

      {isFullscreen && (
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
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search village, district, city..."
            className="w-full border-none bg-transparent text-xs outline-none focus:ring-0"
          />
          {showDropdown && searchResults.length > 0 && (
            <div className="mt-2 max-h-40 w-full overflow-y-auto rounded-md border bg-white text-xs shadow-lg">
              {searchResults.map((r, idx) => (
                <button
                  key={`${r.lat}-${r.lon}-${idx}`}
                  type="button"
                  className="block w-full px-2 py-1 text-left hover:bg-gray-100"
                  onClick={() => {
                    const lat = parseFloat(r.lat)
                    const lon = parseFloat(r.lon)
                    if (Number.isFinite(lat) && Number.isFinite(lon)) {
                      if (mapRef.current) {
                        mapRef.current.flyTo([lat, lon], 15)
                      } else {
                        setSearchTarget([lat, lon])
                      }
                    }
                    const shortName = r.display_name.split(",")[0] ?? r.display_name
                    setSearchQuery(shortName)
                    setShowDropdown(false)
                    setSearchResults([])
                  }}
                >
                  {r.display_name.length > 60
                    ? `${r.display_name.slice(0, 57)}...`
                    : r.display_name}
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