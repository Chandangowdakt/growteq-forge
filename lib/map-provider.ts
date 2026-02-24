/**
 * Provider-agnostic map architecture for Forge
 * Abstracts map rendering, tiles, elevation, and geometry data layers
 * Allows swapping map providers (MapLibre, ISRO Bhuvan, etc.) without core logic changes
 */

export interface MapCoordinates {
  lat: number
  lng: number
}

export interface MapBounds {
  north: number
  south: number
  east: number
  west: number
}

export interface PolygonPoint {
  lat: number
  lng: number
  id: string
}

export interface LandPolygon {
  id: string
  points: PolygonPoint[]
  properties: {
    name?: string
    area?: number
    perimeter?: number
    createdAt: Date
    updatedAt: Date
  }
}

export interface ElevationData {
  lat: number
  lng: number
  elevation: number
}

export interface MapLayerConfig {
  type: 'tiles' | 'elevation' | 'geometry'
  visible: boolean
  opacity: number
  provider?: string
}

/**
 * Abstract map provider interface
 * Implementations can use MapLibre, Leaflet, ISRO Bhuvan, or any GIS service
 */
export interface IMapProvider {
  name: string
  getTileUrl: (x: number, y: number, z: number) => string
  getElevation: (lat: number, lng: number) => Promise<number>
  calculateArea: (polygon: PolygonPoint[]) => number // in sq meters
  calculatePerimeter: (polygon: PolygonPoint[]) => number // in meters
  calculateDistance: (from: MapCoordinates, to: MapCoordinates) => number // in meters
  formatArea: (sqMeters: number) => { value: number; unit: string }
  formatDistance: (meters: number) => { value: number; unit: string }
}

/**
 * OpenStreetMap provider implementation
 */
class OpenStreetMapProvider implements IMapProvider {
  name = 'OpenStreetMap'

  getTileUrl(x: number, y: number, z: number): string {
    return `https://tile.openstreetmap.org/${z}/${x}/${y}.png`
  }

  async getElevation(lat: number, lng: number): Promise<number> {
    // Placeholder: would integrate with elevation API like USGS, OpenTopography, or ISRO
    return 0
  }

  calculateArea(polygon: PolygonPoint[]): number {
    if (polygon.length < 3) return 0
    
    let area = 0
    const n = polygon.length
    
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n
      const lat1 = (polygon[i].lat * Math.PI) / 180
      const lat2 = (polygon[j].lat * Math.PI) / 180
      const dLng = ((polygon[j].lng - polygon[i].lng) * Math.PI) / 180
      
      area += Math.sin(lat1) * Math.cos(lat2) * Math.sin(dLng)
    }
    
    const R = 6371000 // Earth radius in meters
    area = Math.abs((area * R * R) / 2)
    
    return area
  }

  calculatePerimeter(polygon: PolygonPoint[]): number {
    let perimeter = 0
    const n = polygon.length
    
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n
      perimeter += this.calculateDistance(
        { lat: polygon[i].lat, lng: polygon[i].lng },
        { lat: polygon[j].lat, lng: polygon[j].lng }
      )
    }
    
    return perimeter
  }

  calculateDistance(from: MapCoordinates, to: MapCoordinates): number {
    const R = 6371000 // Earth radius in meters
    const dLat = ((to.lat - from.lat) * Math.PI) / 180
    const dLng = ((to.lng - from.lng) * Math.PI) / 180
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((from.lat * Math.PI) / 180) * Math.cos((to.lat * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    
    return R * c
  }

  formatArea(sqMeters: number): { value: number; unit: string } {
    const acres = sqMeters / 4047.86 // 1 acre = 4047.86 sq meters
    if (acres >= 1) {
      return { value: Math.round(acres * 100) / 100, unit: 'acres' }
    }
    return { value: Math.round(sqMeters), unit: 'sq m' }
  }

  formatDistance(meters: number): { value: number; unit: string } {
    if (meters >= 1000) {
      return { value: Math.round((meters / 1000) * 100) / 100, unit: 'km' }
    }
    return { value: Math.round(meters), unit: 'm' }
  }
}

/**
 * Map provider factory - switch providers here
 */
let currentProvider: IMapProvider = new OpenStreetMapProvider()

export const getMapProvider = (): IMapProvider => {
  return currentProvider
}

export const setMapProvider = (provider: IMapProvider): void => {
  currentProvider = provider
}

/**
 * Utility functions for map operations
 */
export const calculatePolygonMetrics = (polygon: PolygonPoint[]) => {
  const provider = getMapProvider()
  const area = provider.calculateArea(polygon)
  const perimeter = provider.calculatePerimeter(polygon)
  const formattedArea = provider.formatArea(area)
  const formattedPerimeter = provider.formatDistance(perimeter)

  return {
    area,
    perimeter,
    formattedArea,
    formattedPerimeter,
    provider: provider.name,
  }
}

export const createPolygonFromCoordinates = (
  coordinates: Array<[number, number]>,
  name?: string
): LandPolygon => {
  return {
    id: `polygon-${Date.now()}`,
    points: coordinates.map((coord, idx) => ({
      lat: coord[0],
      lng: coord[1],
      id: `point-${idx}`,
    })),
    properties: {
      name,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  }
}
