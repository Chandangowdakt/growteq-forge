"use client"
import { useState, useEffect, useRef, FormEvent } from "react"
import { MapContainer, TileLayer, Marker, Polygon, useMapEvents, useMap } from "react-leaflet"
import type { LatLngExpression, Map as LeafletMapInstance } from "leaflet"
import L from "leaflet"
import { polygon, area as turfArea, lineString, length as turfLength } from "@turf/turf"
import "leaflet/dist/leaflet.css"

// Fix default marker icon issue in Next.js
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
}

function ClickHandler({ onSelect }: { onSelect: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onSelect(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

// Component to fly to user's current location
function LocationFlyTo({ coords }: { coords: LatLngExpression | null }) {
  const map = useMap()
  useEffect(() => {
    if (coords) {
      map.flyTo(coords, DEFAULT_ZOOM, { animate: true, duration: 1.5 })
    }
  }, [coords, map])
  return null
}

function SearchFlyTo({ target }: { target: LatLngExpression | null }) {
  const map = useMap()
  useEffect(() => {
    if (target) {
      map.flyTo(target, 17, { animate: true, duration: 1.5 })
    }
  }, [target, map])
  return null
}

export default function LeafletMap({
  boundary,
  onBoundaryChange,
  isFullscreen,
  onExitFullscreen,
}: LeafletMapProps) {
  const [boundaryPoints, setBoundaryPoints] = useState<BoundaryPoint[]>(boundary)
  const [currentLocation, setCurrentLocation] = useState<LatLngExpression | null>(null)
  const [locating, setLocating] = useState(true)
  const lastClickRef = useRef<number | null>(null)
  const [searchValue, setSearchValue] = useState("")
  const [searchTarget, setSearchTarget] = useState<LatLngExpression | null>(null)
  const mapRef = useRef<LeafletMapInstance | null>(null)

  // Get user's current location on mount
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocating(false)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords: LatLngExpression = [pos.coords.latitude, pos.coords.longitude]
        setCurrentLocation(coords)
        setLocating(false)
      },
      () => {
        // Permission denied or error — fall back to default
        setLocating(false)
      },
      { timeout: 8000 }
    )
  }, [])

  // Sync internal state when parent boundary is cleared/reset
  useEffect(() => {
    setBoundaryPoints(boundary)
  }, [boundary])

  // Handle ESC key to exit fullscreen
  useEffect(() => {
    if (!isFullscreen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onExitFullscreen()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [isFullscreen, onExitFullscreen])

  // Lock body scroll when fullscreen is active
  useEffect(() => {
    if (typeof document === "undefined") return
    const previous = document.body.style.overflow
    if (isFullscreen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = "auto"
    }
    return () => {
      document.body.style.overflow = previous
    }
  }, [isFullscreen])

  // Fix map resize when entering/exiting fullscreen
  useEffect(() => {
    if (!mapRef.current) return
    const map = mapRef.current
    const timeoutId = window.setTimeout(() => {
      map.invalidateSize()
    }, 200)
    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [isFullscreen])

  const computeArea = (points: BoundaryPoint[]): number => {
    if (points.length < 3) {
      return 0
    }
    const coords = points.map((p) => [p.lng, p.lat])
    // Close the polygon ring
    coords.push(coords[0])
    const poly = polygon([coords])
    const sqm = turfArea(poly)
    const acres = sqm / 4046.8564224
    return Number(acres.toFixed(2))
  }

  const computePerimeter = (points: BoundaryPoint[]): number => {
    if (points.length < 2) return 0
    const coords = points.map((p) => [p.lng, p.lat])
    coords.push(coords[0])
    const line = lineString(coords)
    const km = turfLength(line, { units: "kilometers" })
    return Number((km * 1000).toFixed(2))
  }

  const handleSelect = (lat: number, lng: number) => {
    const now = Date.now()
    if (lastClickRef.current && now - lastClickRef.current < 300) {
      return
    }
    lastClickRef.current = now

    if (boundaryPoints.length >= 10) {
      return
    }

    const point: BoundaryPoint = {
      lat,
      lng,
      id: `p-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    }
    setBoundaryPoints((prev) => {
      const updated = [...prev, point]
      const area = computeArea(updated)
      onBoundaryChange(updated, area)
      return updated
    })
  }

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault()
    const value = searchValue.trim()
    if (!value) return
    const [latStr, lngStr] = value.split(",")
    const lat = parseFloat(latStr)
    const lng = parseFloat(lngStr)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return
    }
    setSearchTarget([lat, lng])
  }

  const containerClassName = isFullscreen
    ? "fixed inset-0 z-[9999] bg-black transition-all duration-200"
    : "relative h-full w-full"

  return (
    <div className={containerClassName}>
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
        whenCreated={(map) => {
          mapRef.current = map
        }}
      >
        {(() => {
          const token =
            process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? process.env.MAPBOX_TOKEN
          if (!token) {
            return (
              <TileLayer
                attribution="Tiles © Esri"
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                maxZoom={22}
              />
            )
          }
          return (
            <TileLayer
              attribution="© Mapbox © OpenStreetMap"
              url={`https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/{z}/{x}/{y}?access_token=${token}`}
              maxZoom={22}
              tileSize={512}
              zoomOffset={-1}
            />
          )
        })()}
        <ClickHandler onSelect={handleSelect} />
        <LocationFlyTo coords={currentLocation} />
        <SearchFlyTo target={searchTarget} />
        {boundaryPoints.map((point, index) => (
          <Marker
            key={point.id}
            position={[point.lat, point.lng]}
            icon={L.divIcon({
              html: `<div style="background:#387F43;color:white;border-radius:9999px;width:20px;height:20px;display:flex;align-items:center;justify-content:center;font-size:12px;">${
                index + 1
              }</div>`,
              iconSize: [20, 20],
              iconAnchor: [10, 20],
            })}
          />
        ))}
        {boundaryPoints.length >= 3 && (
         <Polygon
         positions={boundary}
         pathOptions={{
           color: "#00F5FF",
           weight: 5,
           opacity: 1,
           fillColor: "#00F5FF",
           fillOpacity: 0.12,
         }}
       />
        )}
      </MapContainer>

      {isFullscreen && (
        <button
          type="button"
          onClick={onExitFullscreen}
          className="absolute top-4 right-4 z-[10000] bg-white text-black px-4 py-2 rounded-lg shadow-md"
        >
          Exit Fullscreen
        </button>
      )}

      {/* Coordinate search box */}
      <div className="pointer-events-none absolute left-4 top-4 z-[1000]">
        <form
          onSubmit={handleSearchSubmit}
          className="pointer-events-auto flex items-center gap-2 rounded-full bg-white/90 px-3 py-1 shadow-sm"
        >
          <input
            type="text"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
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
      </div>

      {/* Measurement panel */}
      <div className="pointer-events-none absolute right-4 bottom-4 z-[1000]">
        <div className="pointer-events-auto rounded-xl bg-white/90 px-3 py-2 text-xs shadow-sm space-y-1">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Points</span>
            <span className="font-medium">{boundaryPoints.length}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Area</span>
            <span className="font-medium">
              {computeArea(boundaryPoints) ? `${computeArea(boundaryPoints)} ac` : "—"}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Perimeter</span>
            <span className="font-medium">
              {computePerimeter(boundaryPoints)
                ? `${computePerimeter(boundaryPoints)} m`
                : "—"}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}