import { Response } from "express"
import { SiteEvaluation } from "../models/SiteEvaluation"
import { asyncHandler } from "../utils/asyncHandler"
import { ApiError } from "../utils/ApiError"
import { AuthenticatedRequest } from "../middleware/auth"

interface MapSnapshotBody {
  siteId?: string
  width?: number
  height?: number
}

const DEFAULT_WIDTH = 800
const DEFAULT_HEIGHT = 600

/** Build GeoJSON Polygon from boundary points (closed ring). */
function boundaryToGeojson(
  boundary: { lat: number; lng: number }[]
): { type: "Polygon"; coordinates: number[][][] } | null {
  if (!boundary || boundary.length < 3) return null
  const coords = boundary.map((p) => [p.lng, p.lat])
  coords.push(coords[0])
  return { type: "Polygon", coordinates: [coords] }
}

export const createMapSnapshot = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { siteId, width, height } = req.body as MapSnapshotBody

    if (!siteId) {
      throw new ApiError(400, "siteId is required")
    }

    const userId = req.auth!.userId

    const site = await SiteEvaluation.findOne({ _id: siteId, userId })
      .select("boundary geojson")
      .lean()

    if (!site) {
      throw new ApiError(404, "Site evaluation not found")
    }

    const boundaryPoints = (site as { boundary?: { lat: number; lng: number }[] }).boundary ?? []
    const geometry =
      (site as { geojson?: { type: "Polygon"; coordinates: number[][][] } }).geojson ??
      boundaryToGeojson(boundaryPoints)

    if (!geometry) {
      throw new ApiError(400, "Site does not have a valid polygon boundary")
    }

    const token = process.env.MAPBOX_TOKEN
    if (!token) {
      throw new ApiError(500, "Mapbox token is not configured")
    }

    const feature = {
      type: "Feature" as const,
      geometry,
      properties: {},
    }

    const encodedGeojson = encodeURIComponent(JSON.stringify(feature))

    const clampedWidth = Math.min(Math.max(width ?? DEFAULT_WIDTH, 1), 1280)
    const clampedHeight = Math.min(Math.max(height ?? DEFAULT_HEIGHT, 1), 1280)

    const styleId = "satellite-streets-v12"
    const username = "mapbox"

    const imageUrl = `https://api.mapbox.com/styles/v1/${username}/${styleId}/static/geojson(${encodedGeojson})/auto/${clampedWidth}x${clampedHeight}?access_token=${token}`

    res.json({
      success: true,
      url: imageUrl,
    })
  }
)

