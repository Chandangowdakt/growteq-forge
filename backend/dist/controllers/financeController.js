"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSummary = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const Proposal_1 = require("../models/Proposal");
const asyncHandler_1 = require("../utils/asyncHandler");
exports.getSummary = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.auth.userId;
    const siteId = req.query.siteId;
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const match = { userId: new mongoose_1.default.Types.ObjectId(userId) };
    if (siteId)
        match.siteId = new mongoose_1.default.Types.ObjectId(siteId);
    const [proposals, totalResult, avgRoiResult, activeCountResult, trendsResult,] = await Promise.all([
        Proposal_1.Proposal.find(match).lean(),
        Proposal_1.Proposal.aggregate([
            { $match: match },
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
            { $match: { ...match, status: { $ne: "rejected" } } },
            {
                $addFields: {
                    roi: { $ifNull: ["$roiMonths", "$content.roiMonths"] },
                },
            },
            { $match: { roi: { $exists: true, $ne: null, $gte: 0 } } },
            { $group: { _id: null, avg: { $avg: "$roi" } } },
        ]),
        Proposal_1.Proposal.countDocuments({ ...match, status: { $ne: "rejected" } }),
        Proposal_1.Proposal.aggregate([
            { $match: { ...match, createdAt: { $gte: sixMonthsAgo } } },
            {
                $addFields: {
                    inv: {
                        $ifNull: [
                            "$investmentValue",
                            { $ifNull: ["$content.investment", { $ifNull: ["$content.estimatedCost", 0] }] },
                        ],
                    },
                    infra: { $ifNull: ["$infrastructureType", "$content.infrastructureType"] },
                },
            },
            {
                $group: {
                    _id: {
                        month: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
                        infrastructureType: "$infra",
                    },
                    total: { $sum: "$inv" },
                },
            },
            { $sort: { "_id.month": 1 } },
        ]),
    ]);
    const totalInvestment = totalResult[0]?.total ?? 0;
    const expectedROI = totalInvestment * 2.15;
    const avgROITimeline = avgRoiResult[0]?.avg ?? 0;
    const activeProposals = activeCountResult ?? 0;
    const trendsByMonth = {};
    for (const t of trendsResult ?? []) {
        const month = t._id.month;
        const infra = String(t._id.infrastructureType ?? "").toLowerCase().replace(/\s/g, "_");
        if (!trendsByMonth[month]) {
            trendsByMonth[month] = { polyhouse: 0, shade_net: 0, open_field: 0 };
        }
        if (infra in trendsByMonth[month]) {
            trendsByMonth[month][infra] = t.total;
        }
        else if (infra === "polyhouse") {
            trendsByMonth[month].polyhouse = t.total;
        }
        else if (infra === "shade_net" || infra === "shadenet") {
            trendsByMonth[month].shade_net = t.total;
        }
        else {
            trendsByMonth[month].open_field = t.total;
        }
    }
    let costTrends = Object.entries(trendsByMonth).map(([month, values]) => ({
        month,
        polyhouse: values.polyhouse ?? 0,
        shade_net: values.shade_net ?? 0,
        open_field: values.open_field ?? 0,
    })).sort((a, b) => a.month.localeCompare(b.month));
    if (costTrends.length === 0) {
        const now = new Date();
        costTrends = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            costTrends.push({
                month: d.toISOString().slice(0, 7),
                polyhouse: 0,
                shade_net: 0,
                open_field: 0,
            });
        }
    }
    const comparison = [
        { type: "polyhouse", roiMonths: 18, profitMargin: "35-40%", initialInvestmentPerAcre: "₹25-35 lakhs" },
        { type: "shade_net", roiMonths: 6, profitMargin: "25-30%", initialInvestmentPerAcre: "₹2-5 lakhs" },
        { type: "open_field", roiMonths: 3, profitMargin: "15-20%", initialInvestmentPerAcre: "₹0.5-2 lakhs" },
    ];
    res.json({
        success: true,
        data: {
            totalInvestment,
            expectedROI,
            avgROITimeline: Math.round(avgROITimeline * 10) / 10,
            activeProposals,
            costTrends,
            comparison,
        },
    });
});
