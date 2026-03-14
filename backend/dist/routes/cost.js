"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const mongoose_1 = __importDefault(require("mongoose"));
const Site_1 = require("../models/Site");
const SiteEvaluation_1 = require("../models/SiteEvaluation");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware);
router.get("/:siteId", async (req, res, next) => {
    try {
        const siteIdParam = req.params.siteId;
        if (!siteIdParam) {
            return res.status(400).json({ success: false, message: "siteId is required" });
        }
        let objectId;
        try {
            objectId = new mongoose_1.default.Types.ObjectId(siteIdParam);
        }
        catch {
            return res.status(400).json({ success: false, message: "siteId must be a valid id" });
        }
        let area = null;
        let infrastructureType = "Polyhouse";
        const evaluation = await SiteEvaluation_1.SiteEvaluation.findById(objectId).lean();
        if (evaluation && typeof evaluation.area === "number") {
            area = evaluation.area;
            if (evaluation.infrastructureRecommendation) {
                infrastructureType = evaluation.infrastructureRecommendation;
            }
        }
        if (area == null) {
            const site = await Site_1.Site.findById(objectId).lean();
            if (site && typeof site.area === "number") {
                area = site.area;
            }
        }
        if (area == null) {
            return res
                .status(404)
                .json({ success: false, message: "Site or evaluation not found for this id" });
        }
        let costPerAcre = 3000000;
        if (infrastructureType === "Shade Net") {
            costPerAcre = 350000;
        }
        else if (infrastructureType === "Open Field") {
            costPerAcre = 100000;
        }
        const investment = area * costPerAcre;
        const finalInvestment = investment * 1.25;
        const annualProfit = finalInvestment * 0.4;
        const roiMonths = finalInvestment / (annualProfit / 12);
        return res.json({
            success: true,
            data: {
                siteId: siteIdParam,
                infrastructureType,
                costPerAcre,
                investment,
                finalInvestment,
                annualProfit,
                roiMonths,
            },
        });
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
