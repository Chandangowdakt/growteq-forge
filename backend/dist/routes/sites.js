"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const Site_1 = require("../models/Site");
const siteEvaluationController_1 = require("../controllers/siteEvaluationController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware);
router.post("/", async (req, res, next) => {
    try {
        const { farmId, name, geojson, area, perimeter, slope, notes } = req.body;
        if (typeof name !== "string" || !name.trim()) {
            return res.status(400).json({ success: false, message: "name is required" });
        }
        if (typeof geojson !== "object" || geojson === null) {
            return res.status(400).json({ success: false, message: "geojson is required" });
        }
        if (typeof area !== "number" || !Number.isFinite(area)) {
            return res.status(400).json({ success: false, message: "area must be a number" });
        }
        if (typeof perimeter !== "number" || !Number.isFinite(perimeter)) {
            return res.status(400).json({ success: false, message: "perimeter must be a number" });
        }
        const createdSite = await Site_1.Site.create({
            name: name.trim(),
            geojson,
            area,
            perimeter,
            ...(farmId != null && { farmId }),
            ...(typeof slope === "number" && Number.isFinite(slope) && { slope }),
            ...(typeof notes === "string" && { notes: notes.trim() }),
        });
        const data = createdSite.toObject();
        return res.status(201).json({
            success: true,
            data: { ...data, id: createdSite._id },
        });
    }
    catch (err) {
        next(err);
    }
});
router.put("/:id", siteEvaluationController_1.updateSiteEvaluation);
router.delete("/:id", siteEvaluationController_1.deleteSiteEvaluation);
router.get("/:siteId/details", siteEvaluationController_1.getSiteDetails);
router.get("/:siteId/boundary", siteEvaluationController_1.getSiteBoundary);
router.get("/:siteId/export", siteEvaluationController_1.getSiteGeojsonExport);
exports.default = router;
