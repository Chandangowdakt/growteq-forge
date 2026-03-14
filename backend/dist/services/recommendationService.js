"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeRecommendation = computeRecommendation;
exports.createProposalFromRecommendation = createProposalFromRecommendation;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const Proposal_1 = require("../models/Proposal");
const mongoose_1 = __importDefault(require("mongoose"));
const INFRASTRUCTURE_JSON = path_1.default.join(__dirname, "..", "config", "infrastructure.json");
const DEFAULTS = {
    polyhouse: { minCostPerAcre: 2500000, maxCostPerAcre: 3500000, roiMonths: 18 },
    shade_net: { minCostPerAcre: 200000, maxCostPerAcre: 500000, roiMonths: 6 },
    open_field: { minCostPerAcre: 50000, maxCostPerAcre: 200000, roiMonths: 3 },
};
function getConfig() {
    if (!fs_1.default.existsSync(INFRASTRUCTURE_JSON))
        return DEFAULTS;
    try {
        const raw = fs_1.default.readFileSync(INFRASTRUCTURE_JSON, "utf8");
        const parsed = JSON.parse(raw);
        return {
            polyhouse: { ...DEFAULTS.polyhouse, ...parsed.polyhouse },
            shade_net: { ...DEFAULTS.shade_net, ...parsed.shade_net },
            open_field: { ...DEFAULTS.open_field, ...parsed.open_field },
        };
    }
    catch {
        return DEFAULTS;
    }
}
function computeRecommendation(area, slope) {
    const a = typeof area === "number" && Number.isFinite(area) ? area : 0;
    const s = typeof slope === "number" && Number.isFinite(slope) ? slope : 0;
    const config = getConfig();
    if (s <= 5) {
        const c = config.polyhouse;
        return { infrastructureType: "polyhouse", investmentValue: a * c.minCostPerAcre, roiMonths: c.roiMonths };
    }
    if (s <= 10) {
        const c = config.shade_net;
        return { infrastructureType: "shade_net", investmentValue: a * c.minCostPerAcre, roiMonths: c.roiMonths };
    }
    const c = config.open_field;
    return { infrastructureType: "open_field", investmentValue: a * c.minCostPerAcre, roiMonths: c.roiMonths };
}
async function createProposalFromRecommendation(userId, area, slope, options) {
    const { infrastructureType, investmentValue, roiMonths } = computeRecommendation(area, slope);
    const proposal = await Proposal_1.Proposal.create({
        userId: new mongoose_1.default.Types.ObjectId(userId),
        title: `Recommended: ${infrastructureType}`,
        status: "recommended",
        investmentValue,
        roiMonths,
        infrastructureType,
        content: { area, slope, investmentValue, roiMonths, infrastructureType },
        ...(options.siteEvaluationId && { siteEvaluationId: options.siteEvaluationId }),
        ...(options.siteId && { siteId: new mongoose_1.default.Types.ObjectId(options.siteId) }),
    });
    return proposal;
}
