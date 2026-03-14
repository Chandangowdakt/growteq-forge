"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSiteGeojsonExport = exports.getSiteBoundary = exports.getSiteDetails = exports.deleteSiteEvaluation = exports.updateSiteEvaluation = exports.updateStatus = exports.getSiteEvaluation = exports.createSiteEvaluation = exports.listSiteEvaluations = void 0;
const SiteEvaluation_1 = require("../models/SiteEvaluation");
const Site_1 = require("../models/Site");
const Proposal_1 = require("../models/Proposal");
const ApiError_1 = require("../utils/ApiError");
const asyncHandler_1 = require("../utils/asyncHandler");
const recommendationService_1 = require("../services/recommendationService");
const notificationController_1 = require("./notificationController");
exports.listSiteEvaluations = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.auth.userId;
    const farmId = req.query.farmId;
    const status = req.query.status;
    const filter = { userId };
    if (farmId)
        filter.farmId = farmId;
    if (status)
        filter.status = status;
    const evaluations = await SiteEvaluation_1.SiteEvaluation.find(filter)
        .populate("siteId", "name area")
        .sort({ updatedAt: -1 })
        .lean();
    const evalIds = evaluations.map((e) => e._id);
    const proposals = await Proposal_1.Proposal.find({
        userId,
        siteEvaluationId: { $in: evalIds },
    })
        .select("siteEvaluationId")
        .lean();
    const proposalByEval = new Map(proposals.map((p) => [String(p.siteEvaluationId), String(p._id)]));
    const data = evaluations.map((e) => ({
        ...e,
        proposalId: proposalByEval.get(String(e._id)) ?? null,
    }));
    res.json({ success: true, data });
});
exports.createSiteEvaluation = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.auth.userId;
    const { siteId, farmId, soilType, waterAvailability, slopePercentage, elevationMeters, sunExposure, notes, } = req.body;
    if (!siteId || !farmId || !soilType || !waterAvailability || slopePercentage == null) {
        throw new ApiError_1.ApiError(400, "siteId, farmId, soilType, waterAvailability, and slopePercentage are required");
    }
    const evaluation = await SiteEvaluation_1.SiteEvaluation.create({
        userId,
        siteId,
        farmId,
        soilType: String(soilType).trim(),
        waterAvailability: String(waterAvailability).trim(),
        slopePercentage: Number(slopePercentage),
        elevationMeters: elevationMeters != null ? Number(elevationMeters) : undefined,
        sunExposure: sunExposure ?? "full",
        notes: notes?.trim?.(),
    });
    const site = await Site_1.Site.findById(siteId).lean();
    const area = site?.area ?? 0;
    const slope = Number(slopePercentage);
    const proposal = await (0, recommendationService_1.createProposalFromRecommendation)(userId, area, slope, {
        siteEvaluationId: evaluation._id,
        siteId: String(siteId),
    });
    const siteName = site?.name ?? "Site";
    await (0, notificationController_1.createNotification)({
        userId,
        title: "Site evaluation created",
        message: `Site evaluation created for ${siteName}`,
        type: "info",
        relatedEntityType: "SiteEvaluation",
        relatedEntityId: evaluation._id,
    });
    const evaluationWithSite = await SiteEvaluation_1.SiteEvaluation.findById(evaluation._id)
        .populate("siteId", "name area")
        .lean();
    res.status(201).json({
        success: true,
        data: {
            evaluation: evaluationWithSite ?? evaluation,
            proposal,
        },
    });
});
exports.getSiteEvaluation = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.auth.userId;
    const evaluation = await SiteEvaluation_1.SiteEvaluation.findOne({ _id: req.params.id, userId })
        .populate("siteId")
        .lean();
    if (!evaluation)
        throw new ApiError_1.ApiError(404, "Site evaluation not found");
    const proposal = await Proposal_1.Proposal.findOne({
        siteEvaluationId: evaluation._id,
        userId,
    }).lean();
    res.json({
        success: true,
        data: { ...evaluation, proposal: proposal ?? null },
    });
});
exports.updateStatus = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.auth.userId;
    const { status } = req.body;
    const allowed = ["submitted", "approved", "rejected"];
    if (!status || !allowed.includes(status)) {
        throw new ApiError_1.ApiError(400, "status must be one of: submitted, approved, rejected");
    }
    const evaluation = await SiteEvaluation_1.SiteEvaluation.findOneAndUpdate({ _id: req.params.id, userId }, { $set: { status } }, { new: true });
    if (!evaluation)
        throw new ApiError_1.ApiError(404, "Site evaluation not found");
    await (0, notificationController_1.createNotification)({
        userId,
        title: "Evaluation status updated",
        message: `Evaluation status updated to ${status}`,
        type: "info",
        relatedEntityType: "SiteEvaluation",
        relatedEntityId: evaluation._id,
    });
    res.json({ success: true, data: evaluation });
});
exports.updateSiteEvaluation = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.auth.userId;
    const allowed = [
        "soilType",
        "waterAvailability",
        "slopePercentage",
        "elevationMeters",
        "sunExposure",
        "notes",
    ];
    const update = {};
    for (const key of allowed) {
        if (req.body[key] !== undefined)
            update[key] = req.body[key];
    }
    const evaluation = await SiteEvaluation_1.SiteEvaluation.findOneAndUpdate({ _id: req.params.id, userId }, { $set: update }, { new: true, runValidators: true });
    if (!evaluation)
        throw new ApiError_1.ApiError(404, "Site evaluation not found");
    res.json({ success: true, data: evaluation });
});
exports.deleteSiteEvaluation = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.auth.userId;
    const evaluation = await SiteEvaluation_1.SiteEvaluation.findOneAndDelete({ _id: req.params.id, userId });
    if (!evaluation)
        throw new ApiError_1.ApiError(404, "Site evaluation not found");
    res.json({ success: true, message: "Site evaluation deleted" });
});
exports.getSiteDetails = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const siteId = req.params.siteId;
    const site = await Site_1.Site.findById(siteId).lean();
    if (!site)
        throw new ApiError_1.ApiError(404, "Site not found");
    res.json({ success: true, data: site });
});
exports.getSiteBoundary = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const siteId = req.params.siteId;
    const site = await Site_1.Site.findById(siteId).select("geojson").lean();
    if (!site)
        throw new ApiError_1.ApiError(404, "Site not found");
    res.json({ success: true, data: site.geojson ?? null });
});
exports.getSiteGeojsonExport = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const siteId = req.params.siteId;
    const site = await Site_1.Site.findById(siteId).select("geojson").lean();
    if (!site)
        throw new ApiError_1.ApiError(404, "Site not found");
    res.json({ success: true, data: site.geojson ?? null });
});
