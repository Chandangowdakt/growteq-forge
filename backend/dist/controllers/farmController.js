"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFarmSites = exports.deleteFarm = exports.updateFarm = exports.getFarm = exports.createFarm = exports.listFarms = void 0;
const Farm_1 = require("../models/Farm");
const Site_1 = require("../models/Site");
const ApiError_1 = require("../utils/ApiError");
const asyncHandler_1 = require("../utils/asyncHandler");
const notDeleted = { deletedAt: { $exists: false } };
exports.listFarms = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.auth.userId;
    const farms = await Farm_1.Farm.find({ userId, ...notDeleted }).sort({ createdAt: -1 }).lean();
    const farmIds = farms.map((f) => f._id);
    const counts = await Site_1.Site.aggregate([
        { $match: { farmId: { $in: farmIds } } },
        { $group: { _id: "$farmId", count: { $sum: 1 } } },
    ]);
    const countByFarm = new Map(counts.map((c) => [String(c._id), c.count]));
    const data = farms.map((f) => ({
        ...f,
        siteCount: countByFarm.get(String(f._id)) ?? 0,
    }));
    res.json({ success: true, data });
});
exports.createFarm = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.auth.userId;
    const { name, location, totalArea, country, state, district, description } = req.body;
    if (!name || typeof name !== "string" || !name.trim()) {
        throw new ApiError_1.ApiError(400, "Farm name is required");
    }
    const farm = await Farm_1.Farm.create({
        userId,
        name: name.trim(),
        location: location?.trim?.() ?? undefined,
        totalArea: totalArea != null ? Number(totalArea) : undefined,
        country: country?.trim?.() ?? undefined,
        state: state?.trim?.() ?? undefined,
        district: district?.trim?.() ?? undefined,
        description: description?.trim?.() ?? undefined,
    });
    res.status(201).json({ success: true, data: farm });
});
exports.getFarm = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.auth.userId;
    const farmId = req.params.farmId ?? req.params.id;
    const farm = await Farm_1.Farm.findOne({ _id: farmId, userId, ...notDeleted });
    if (!farm)
        throw new ApiError_1.ApiError(404, "Farm not found");
    const siteCount = await Site_1.Site.countDocuments({ farmId: farm._id });
    const data = farm.toObject ? farm.toObject() : farm;
    res.json({ success: true, data: { ...data, siteCount } });
});
exports.updateFarm = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.auth.userId;
    const farmId = req.params.farmId ?? req.params.id;
    const allowed = ["name", "location", "totalArea", "country", "state", "district", "description"];
    const update = {};
    for (const key of allowed) {
        if (req.body[key] !== undefined)
            update[key] = req.body[key];
    }
    const farm = await Farm_1.Farm.findOneAndUpdate({ _id: farmId, userId, ...notDeleted }, { $set: update }, { new: true, runValidators: true });
    if (!farm)
        throw new ApiError_1.ApiError(404, "Farm not found");
    res.json({ success: true, data: farm });
});
exports.deleteFarm = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.auth.userId;
    const farmId = req.params.farmId ?? req.params.id;
    const farm = await Farm_1.Farm.findOneAndUpdate({ _id: farmId, userId, ...notDeleted }, { $set: { deletedAt: new Date() } }, { new: true });
    if (!farm)
        throw new ApiError_1.ApiError(404, "Farm not found");
    res.json({ success: true, message: "Farm deleted" });
});
exports.getFarmSites = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.auth.userId;
    const farmId = req.params.farmId ?? req.params.id;
    const farm = await Farm_1.Farm.findOne({ _id: farmId, userId, ...notDeleted });
    if (!farm)
        throw new ApiError_1.ApiError(404, "Farm not found");
    const sites = await Site_1.Site.find({ farmId: farm._id }).sort({ createdAt: -1 });
    res.json({ success: true, data: sites });
});
