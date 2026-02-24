'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PolygonPoint, LandPolygon, calculatePolygonMetrics } from '@/lib/map-provider'
import { Trash2, UndoIcon, Save, MapPin } from 'lucide-react'
import { google } from 'google-maps'

interface InteractiveMapProps {
  onPolygonComplete?: (polygon: LandPolygon) => void
  onPolygonChange?: (polygon: LandPolygon | null) => void
  savedPolygons?: LandPolygon[]
}

export const InteractiveMap: React.FC<InteractiveMapProps> = ({
  onPolygonComplete,
  onPolygonChange,
  savedPolygons = [],
}) => {
  const mapRef = useRef<HTMLDivElement>(null)
  const googleMapRef = useRef<google.maps.Map | null>(null)
  const drawingManagerRef = useRef<google.maps.drawing.DrawingManager | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentPolygon, setCurrentPolygon] = useState<PolygonPoint[]>([])
  const [metrics, setMetrics] = useState<any>(null)
  const [siteName, setSiteName] = useState('')
  const [drawnPolygons, setDrawnPolygons] = useState<google.maps.Polygon[]>([])
  const polygonHistoryRef = useRef<PolygonPoint[][]>([])

  // Initialize Google Map
  useEffect(() => {
    if (!mapRef.current) return

    // Check if Google Maps API is loaded
    if (typeof window.google === 'undefined') {
      console.warn('Google Maps API not loaded')
      return
    }

    const map = new window.google.maps.Map(mapRef.current, {
      center: { lat: 13.1939, lng: 77.5941 }, // Bangalore
      zoom: 12,
      mapTypeId: window.google.maps.MapTypeId.SATELLITE,
    })

    googleMapRef.current = map

    // Initialize Drawing Manager
    const drawingManager = new window.google.maps.drawing.DrawingManager({
      drawingMode: null,
      drawingControl: false,
    })

    drawingManager.setMap(map)
    drawingManagerRef.current = drawingManager

    // Handle polygon complete event
    const polygonCompleteListener = map.addListener('idle', () => {
      // Update when map is idle
    })

    window.google.maps.event.addListener(drawingManager, 'polygoncomplete', (polygon: google.maps.Polygon) => {
      const path = polygon.getPath()
      const points: PolygonPoint[] = []

      path.forEach((latLng, index) => {
        points.push({
          lat: latLng.lat(),
          lng: latLng.lng(),
          id: `point-${index}`,
        })
      })

      setCurrentPolygon(points)
      polygonHistoryRef.current.push(points)

      // Set drawing mode to null after polygon is drawn
      drawingManager.setDrawingMode(null)
      setIsDrawing(false)

      // Store the polygon reference
      setDrawnPolygons([...drawnPolygons, polygon])
    })

    return () => {
      window.google.maps.event.removeListener(polygonCompleteListener)
    }
  }, [])

  // Update metrics when polygon changes
  useEffect(() => {
    if (currentPolygon.length >= 3) {
      const newMetrics = calculatePolygonMetrics(currentPolygon)
      setMetrics(newMetrics)
      onPolygonChange?.({
        id: `temp-${Date.now()}`,
        points: currentPolygon,
        properties: {
          name: siteName,
          area: newMetrics.area,
          perimeter: newMetrics.perimeter,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      })
    } else if (currentPolygon.length === 0) {
      setMetrics(null)
      onPolygonChange?.(null)
    }
  }, [currentPolygon, siteName, onPolygonChange])

  const handleStartDrawing = () => {
    if (drawingManagerRef.current) {
      drawingManagerRef.current.setDrawingMode(window.google.maps.drawing.OverlayType.POLYGON)
      setIsDrawing(true)
    }
  }

  const handleUndo = () => {
    if (drawnPolygons.length > 0) {
      const lastPolygon = drawnPolygons[drawnPolygons.length - 1]
      lastPolygon.setMap(null)
      setDrawnPolygons(drawnPolygons.slice(0, -1))

      if (polygonHistoryRef.current.length > 0) {
        polygonHistoryRef.current.pop()
        const previous = polygonHistoryRef.current[polygonHistoryRef.current.length - 1] || []
        setCurrentPolygon(previous)
      }
    }
  }

  const handleReset = () => {
    // Clear all drawn polygons from map
    drawnPolygons.forEach((polygon) => polygon.setMap(null))
    setDrawnPolygons([])
    setCurrentPolygon([])
    polygonHistoryRef.current = []
    setMetrics(null)
    setSiteName('')

    if (drawingManagerRef.current) {
      drawingManagerRef.current.setDrawingMode(null)
    }
    setIsDrawing(false)
  }

  const handleSavePolygon = () => {
    if (currentPolygon.length >= 3) {
      const polygon: LandPolygon = {
        id: `polygon-${Date.now()}`,
        points: currentPolygon,
        properties: {
          name: siteName || `Site ${new Date().toLocaleDateString()}`,
          area: metrics?.area,
          perimeter: metrics?.perimeter,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      }
      onPolygonComplete?.(polygon)
      handleReset()
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-[#387F43]" />
                Google Maps - Land Boundary Marking
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div
                ref={mapRef}
                style={{
                  width: '100%',
                  height: '500px',
                  borderRadius: '0.5rem',
                  border: '2px solid #e5e7eb',
                }}
              />
              <div className="mt-4 flex gap-2">
                <Button
                  onClick={handleStartDrawing}
                  disabled={isDrawing}
                  className={isDrawing ? 'bg-gray-400' : 'bg-[#387F43] hover:bg-[#2d6535]'}
                >
                  {isDrawing ? 'Drawing...' : 'Draw Boundary'}
                </Button>
                <Button variant="outline" onClick={handleUndo} disabled={drawnPolygons.length === 0}>
                  <UndoIcon className="h-4 w-4 mr-2" />
                  Undo
                </Button>
                <Button variant="outline" onClick={handleReset} disabled={drawnPolygons.length === 0}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Site Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Site Name</label>
                <Input
                  value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
                  placeholder="Enter site name"
                  className="mt-1"
                />
              </div>

              {metrics && (
                <div className="space-y-3 p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-xs text-muted-foreground">Area</p>
                    <p className="text-lg font-bold text-[#387F43]">
                      {metrics.formattedArea.value} {metrics.formattedArea.unit}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Perimeter</p>
                    <p className="text-lg font-bold text-blue-600">
                      {metrics.formattedPerimeter.value} {metrics.formattedPerimeter.unit}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Points</p>
                    <p className="text-lg font-bold">{currentPolygon.length}</p>
                  </div>
                </div>
              )}

              <Button
                onClick={handleSavePolygon}
                disabled={currentPolygon.length < 3}
                className="w-full bg-[#387F43] hover:bg-[#2d6535]"
              >
                <Save className="h-4 w-4 mr-2" />
                Save Site
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
