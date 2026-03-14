"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSummary = exports.getWorkInProgress = void 0;
const Site_1 = require("../models/Site");
const Proposal_1 = require("../models/Proposal");
const SiteEvaluation_1 = require("../models/SiteEvaluation");
const asyncHandler_1 = require("../utils/asyncHandler");
const COMPLETION_PCT = { draft: 30, submitted: 60, approved: 100, rejected: 0 };
function completionPercent(status) {
    return COMPLETION_PCT[status] ?? 30;
}
exports.getWorkInProgress = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.auth.userId;
    const evaluations = await SiteEvaluation_1.SiteEvaluation.find({ userId })
        .populate("farmId", "name")
        .populate("siteId", "name area geojson")
        .sort({ updatedAt: -1 })
        .lean();
    const evalIds = evaluations.map((e) => e._id);
    const proposals = await Proposal_1.Proposal.find({ siteEvaluationId: { $in: evalIds } })
        .select("siteEvaluationId")
        .lean();
    const proposalByEval = new Map(proposals.map((p) => [String(p.siteEvaluationId), String(p._id)]));
    const data = evaluations.map((e) => {
        const farm = e.farmId;
        const site = e.siteId;
        let boundaryPointCount = 0;
        if (site?.geojson && Array.isArray(site.geojson.coordinates?.[0])) {
            boundaryPointCount = site.geojson.coordinates[0].length;
        }
        return {
            _id: e._id,
            farmName: farm?.name ?? "Farm",
            siteName: site?.name ?? "Site",
            area: site?.area ?? 0,
            status: e.status,
            createdAt: e.createdAt,
            updatedAt: e.updatedAt,
            boundaryPointCount,
            boundaryPoints: boundaryPointCount,
            completionPercentage: completionPercent(e.status),
            proposalId: proposalByEval.get(String(e._id)) ?? null,
        };
    });
    res.json({ success: true, data });
});
exports.getSummary = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.auth.userId;
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const [totalSites, sitesAreaResult, totalProposals, pipelineResult, avgRoiResult, revenueTrendResult] = await Promise.all([
        Site_1.Site.countDocuments(),
        Site_1.Site.aggregate([{ $group: { _id: null, total: { $sum: "$area" } } }]),
        Proposal_1.Proposal.countDocuments(),
        Proposal_1.Proposal.aggregate([
            { $match: { status: { $ne: "rejected" } } },
            {
                $addFields: {
                    inv: {
                        $ifNull: [
                            "$investmentValue",
                            { $ifNull: ["$content.investment", { $ifNull: ["$content.estimatedCost", 0] }] },
                        ],
                    },
                },
            },
            { $group: { _id: null, total: { $sum: "$inv" } } },
        ]),
        Proposal_1.Proposal.aggregate([
            {
                $addFields: {
                    roi: { $ifNull: ["$roiMonths", "$content.roiMonths"] },
                },
            },
            { $match: { roi: { $exists: true, $ne: null, $gte: 0 } } },
            { $group: { _id: null, avg: { $avg: "$roi" } } },
        ]),
        Proposal_1.Proposal.aggregate([
            { $match: { createdAt: { $gte: sixMonthsAgo } } },
            {
                $addFields: {
                    inv: {
                        $ifNull: [
                            "$investmentValue",
                            { $ifNull: ["$content.investment", { $ifNull: ["$content.estimatedCost", 0] }] },
                        ],
                    },
                },
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
                    value: { $sum: "$inv" },
                },
            },
            { $sort: { _id: 1 } },
            { $project: { month: "$_id", value: 1, _id: 0 } },
        ]),
    ]);
    const totalArea = sitesAreaResult[0]?.total ?? 0;
    const pipelineValue = pipelineResult[0]?.total ?? 0;
    const averageROI = avgRoiResult[0]?.avg ?? 0;
    const revenueTrend = (revenueTrendResult ?? []).map((r) => ({ month: r.month, value: r.value }));
    res.json({
        success: true,
        data: {
            totalSites,
            totalArea,
            totalProposals,
            pipelineValue,
            averageROI: Math.round(averageROI * 10) / 10,
            revenueTrend,
        },
    });
});
