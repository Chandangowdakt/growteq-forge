"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMapSnapshot = void 0;
const SiteEvaluation_1 = require("../models/SiteEvaluation");
const asyncHandler_1 = require("../utils/asyncHandler");
const ApiError_1 = require("../utils/ApiError");
const DEFAULT_WIDTH = 800;
const DEFAULT_HEIGHT = 600;
/** Build GeoJSON Polygon from boundary points (closed ring). */
function boundaryToGeojson(boundary) {
    if (!boundary || boundary.length < 3)
        return null;
    const coords = boundary.map((p) => [p.lng, p.lat]);
    coords.push(coords[0]);
    return { type: "Polygon", coordinates: [coords] };
}
exports.createMapSnapshot = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { siteId, width, height } = req.body;
    if (!siteId) {
        throw new ApiError_1.ApiError(400, "siteId is required");
    }
    const userId = req.auth.userId;
    const site = await SiteEvaluation_1.SiteEvaluation.findOne({ _id: siteId, userId })
        .select("boundary geojson")
        .lean();
    if (!site) {
        throw new ApiError_1.ApiError(404, "Site evaluation not found");
    }
    const boundaryPoints = site.boundary ?? [];
    const geometry = site.geojson ??
        boundaryToGeojson(boundaryPoints);
    if (!geometry) {
        throw new ApiError_1.ApiError(400, "Site does not have a valid polygon boundary");
    }
    const token = process.env.MAPBOX_TOKEN;
    if (!token) {
        throw new ApiError_1.ApiError(500, "Mapbox token is not configured");
    }
    const feature = {
        type: "Feature",
        geometry,
        properties: {},
    };
    const encodedGeojson = encodeURIComponent(JSON.stringify(feature));
    const clampedWidth = Math.min(Math.max(width ?? DEFAULT_WIDTH, 1), 1280);
    const clampedHeight = Math.min(Math.max(height ?? DEFAULT_HEIGHT, 1), 1280);
    const styleId = "satellite-streets-v12";
    const username = "mapbox";
    const imageUrl = `https://api.mapbox.com/styles/v1/${username}/${styleId}/static/geojson(${encodedGeojson})/auto/${clampedWidth}x${clampedHeight}?access_token=${token}`;
    res.json({
        success: true,
        url: imageUrl,
    });
});
