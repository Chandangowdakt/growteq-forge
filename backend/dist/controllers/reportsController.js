"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateReport = exports.generateFarmReport = exports.deleteReport = exports.generateProposalReport = exports.downloadReport = exports.listReportTypes = exports.listReports = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const jspdf_1 = require("jspdf");
const asyncHandler_1 = require("../utils/asyncHandler");
const ApiError_1 = require("../utils/ApiError");
const SiteEvaluation_1 = require("../models/SiteEvaluation");
const Proposal_1 = require("../models/Proposal");
const notificationController_1 = require("./notificationController");
const REPORT_TYPES = [
    "site_evaluation",
    "infrastructure_proposal",
    "cost_estimate",
    "sales_pipeline",
    "site_comparison",
    "executive_summary",
];
function reportTypeFromFileName(fileName) {
    const lower = fileName.toLowerCase();
    if (lower.startsWith("report-site_evaluation-") || lower.startsWith("farm-report-"))
        return "site_evaluation";
    if (lower.startsWith("report-infrastructure_proposal-") || lower.startsWith("proposal-"))
        return "infrastructure_proposal";
    if (lower.startsWith("report-cost_estimate-"))
        return "cost_estimate";
    if (lower.startsWith("report-sales_pipeline-"))
        return "sales_pipeline";
    if (lower.startsWith("report-site_comparison-"))
        return "site_comparison";
    if (lower.startsWith("report-executive_summary-"))
        return "executive_summary";
    return null;
}
exports.listReports = (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
    const reportsDir = path_1.default.join(__dirname, "..", "..", "public", "reports");
    if (!fs_1.default.existsSync(reportsDir)) {
        return res.json({ success: true, data: [] });
    }
    const files = fs_1.default.readdirSync(reportsDir).filter((f) => f.toLowerCase().endsWith(".pdf"));
    const data = files.map((fileName) => {
        const filePath = path_1.default.join(reportsDir, fileName);
        const stat = fs_1.default.statSync(filePath);
        let type = "unknown";
        if (fileName.startsWith("farm-report-")) {
            type = "farm";
        }
        else if (fileName.startsWith("proposal-") || fileName.startsWith("proposal-report-")) {
            type = "proposal";
        }
        return {
            type,
            url: `/reports/${fileName}`,
            createdAt: stat.mtime.toISOString(),
        };
    });
    res.json({ success: true, data });
});
exports.listReportTypes = (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
    const reportsDir = path_1.default.join(__dirname, "..", "..", "public", "reports");
    const lastByType = {};
    if (fs_1.default.existsSync(reportsDir)) {
        const files = fs_1.default.readdirSync(reportsDir).filter((f) => f.toLowerCase().endsWith(".pdf") || f.toLowerCase().endsWith(".csv"));
        for (const fileName of files) {
            const filePath = path_1.default.join(reportsDir, fileName);
            const stat = fs_1.default.statSync(filePath);
            const type = reportTypeFromFileName(fileName);
            if (type) {
                const mtime = stat.mtime.toISOString().slice(0, 10);
                if (!lastByType[type] || mtime > lastByType[type])
                    lastByType[type] = mtime;
            }
        }
    }
    const data = REPORT_TYPES.map((reportType) => ({
        reportType,
        lastGeneratedAt: lastByType[reportType] ?? null,
    }));
    res.json({ success: true, data });
});
exports.downloadReport = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { fileName } = req.params;
    if (!fileName) {
        throw new ApiError_1.ApiError(400, "fileName is required");
    }
    const reportsDir = path_1.default.join(__dirname, "..", "..", "public", "reports");
    const filePath = path_1.default.join(reportsDir, fileName);
    if (!fs_1.default.existsSync(filePath)) {
        throw new ApiError_1.ApiError(404, "Report not found");
    }
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.sendFile(path_1.default.resolve(filePath));
});
exports.generateProposalReport = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.auth.userId;
    const proposalId = req.params.proposalId;
    if (!proposalId) {
        throw new ApiError_1.ApiError(400, "proposalId is required");
    }
    const proposal = await Proposal_1.Proposal.findOne({ _id: proposalId, userId })
        .populate("siteId")
        .populate("siteEvaluationId")
        .lean();
    if (!proposal) {
        throw new ApiError_1.ApiError(404, "Proposal not found");
    }
    const site = proposal.siteId;
    const evaluation = proposal.siteEvaluationId;
    const siteName = site?.name ?? evaluation?.name ?? "Site";
    const area = site?.area ?? evaluation?.area ?? 0;
    const slope = site?.slope ?? evaluation?.slope ?? 0;
    const infrastructureType = proposal.infrastructureType ??
        proposal.content?.infrastructureType ??
        "N/A";
    const investmentValue = proposal.investmentValue ??
        proposal.content?.investment ??
        proposal.content?.investmentValue ??
        0;
    const roiMonths = proposal.roiMonths ??
        proposal.content?.roiMonths ??
        0;
    const doc = new jspdf_1.jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 20;
    doc.setFontSize(16);
    doc.text("Infrastructure Proposal Report", pageWidth / 2, y, { align: "center" });
    y += 12;
    doc.setFontSize(11);
    doc.text(`Site: ${siteName}`, 20, y);
    y += 6;
    doc.text(`Area: ${area} acres`, 20, y);
    y += 6;
    doc.text(`Slope: ${slope}%`, 20, y);
    y += 8;
    doc.text(`Infrastructure type: ${infrastructureType}`, 20, y);
    y += 6;
    doc.text(`Investment value: ₹${Number(investmentValue).toLocaleString("en-IN")}`, 20, y);
    y += 6;
    doc.text(`ROI: ${roiMonths} months`, 20, y);
    y += 12;
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text("Generated by Growteq Farm Management System", 20, y);
    const buffer = Buffer.from(doc.output("arraybuffer"));
    const reportsDir = path_1.default.join(__dirname, "..", "..", "public", "reports");
    if (!fs_1.default.existsSync(reportsDir)) {
        fs_1.default.mkdirSync(reportsDir, { recursive: true });
    }
    const fileName = `${proposalId}.pdf`;
    const filePath = path_1.default.join(reportsDir, fileName);
    fs_1.default.writeFileSync(filePath, buffer);
    const downloadUrl = `/api/reports/download/${fileName}`;
    const proposalUserId = String(proposal.userId);
    await (0, notificationController_1.createNotification)({
        userId: proposalUserId,
        title: "Proposal report ready",
        message: "Proposal report ready for download",
        type: "success",
        relatedEntityType: "Proposal",
        relatedEntityId: proposal._id,
    });
    res.status(201).json({
        success: true,
        data: { fileName, downloadUrl },
    });
});
exports.deleteReport = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { fileName } = req.params;
    if (!fileName) {
        throw new ApiError_1.ApiError(400, "fileName is required");
    }
    const reportsDir = path_1.default.join(__dirname, "..", "..", "public", "reports");
    const filePath = path_1.default.join(reportsDir, fileName);
    if (!fs_1.default.existsSync(filePath)) {
        throw new ApiError_1.ApiError(404, "Report not found");
    }
    fs_1.default.unlinkSync(filePath);
    res.json({ success: true });
});
exports.generateFarmReport = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.auth.userId;
    const { farmId } = req.params;
    if (!farmId) {
        throw new ApiError_1.ApiError(400, "farmId is required");
    }
    const sites = await SiteEvaluation_1.SiteEvaluation.find({
        userId,
        farmId,
    });
    if (!sites.length) {
        throw new ApiError_1.ApiError(404, "No sites found for this farm");
    }
    const siteById = new Map();
    const siteIds = [];
    for (const site of sites) {
        const id = String(site._id);
        siteById.set(id, site);
        siteIds.push(id);
    }
    const proposals = await Proposal_1.Proposal.find({
        userId,
        siteEvaluationId: { $in: siteIds },
    }).sort({ createdAt: -1 });
    // Prepare PDF
    const doc = new jspdf_1.jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let y = 20;
    doc.setFontSize(14);
    doc.text("Farm Proposal Summary Report", pageWidth / 2, y, { align: "center" });
    y += 8;
    doc.setFontSize(10);
    doc.text(`Farm ID: ${farmId}`, 20, y);
    y += 6;
    doc.text(`Generated: ${new Date().toLocaleString("en-IN")}`, 20, y);
    y += 10;
    if (!proposals.length) {
        doc.text("No proposals found for this farm.", 20, y);
    }
    else {
        doc.setFontSize(11);
        doc.text("Proposals by Site", 20, y);
        y += 8;
        doc.setFontSize(10);
        for (const proposal of proposals) {
            const siteId = String(proposal.siteEvaluationId);
            const site = siteById.get(siteId);
            const content = (proposal.content ?? {});
            if (y > pageHeight - 40) {
                doc.addPage();
                y = 20;
            }
            doc.setFontSize(10);
            doc.text(`Site: ${site?.name ?? "Unknown"} (ID: ${siteId})`, 20, y);
            y += 5;
            doc.text(`Area: ${site?.area ?? 0} ${site?.areaUnit ?? "acres"} | Status: ${site?.status ?? "draft"}`, 20, y);
            y += 5;
            const infra = content.infrastructureType ?? "N/A";
            const cost = typeof content.estimatedCost === "number"
                ? `₹${content.estimatedCost.toLocaleString("en-IN")}`
                : "N/A";
            const roi = typeof content.roiMonths === "number"
                ? `${content.roiMonths} months`
                : "N/A";
            const score = typeof content.suitabilityScore === "number"
                ? `${content.suitabilityScore.toFixed(1)}`
                : "N/A";
            doc.text(`Infrastructure: ${infra}`, 20, y);
            y += 5;
            doc.text(`Estimated Cost: ${cost}`, 20, y);
            y += 5;
            doc.text(`ROI: ${roi}`, 20, y);
            y += 5;
            doc.text(`Suitability Score: ${score}`, 20, y);
            y += 8;
        }
    }
    // Footer
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text("Generated by Growteq Farm Planning System", 20, pageHeight - 14);
    doc.text("Growteq Agri Farms Pvt Ltd", 20, pageHeight - 6);
    const buffer = Buffer.from(doc.output("arraybuffer"));
    const reportsDir = path_1.default.join(__dirname, "..", "..", "public", "reports");
    if (!fs_1.default.existsSync(reportsDir)) {
        fs_1.default.mkdirSync(reportsDir, { recursive: true });
    }
    const fileName = `farm-report-${farmId}-${Date.now()}.pdf`;
    const filePath = path_1.default.join(reportsDir, fileName);
    fs_1.default.writeFileSync(filePath, buffer);
    const url = `/reports/${fileName}`;
    res.json({
        success: true,
        url,
    });
});
exports.generateReport = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.auth.userId;
    const { reportType, siteIds, format } = req.body;
    if (!reportType || !REPORT_TYPES.includes(reportType)) {
        throw new ApiError_1.ApiError(400, "reportType must be one of: " + REPORT_TYPES.join(", "));
    }
    const fmt = format === "excel" ? "excel" : "pdf";
    const reportsDir = path_1.default.join(__dirname, "..", "..", "public", "reports");
    if (!fs_1.default.existsSync(reportsDir)) {
        fs_1.default.mkdirSync(reportsDir, { recursive: true });
    }
    const timestamp = Date.now();
    const safeType = reportType.replace(/[^a-z_]/gi, "_");
    const ext = fmt === "excel" ? "csv" : "pdf";
    const fileName = `report-${safeType}-${timestamp}.${ext}`;
    const filePath = path_1.default.join(reportsDir, fileName);
    if (fmt === "pdf") {
        const doc = new jspdf_1.jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
        const pageWidth = doc.internal.pageSize.getWidth();
        doc.setFontSize(16);
        doc.text(reportType.replace(/_/g, " ").toUpperCase() + " Report", pageWidth / 2, 20, { align: "center" });
        doc.setFontSize(10);
        doc.text(`Generated: ${new Date().toISOString().slice(0, 10)}`, 20, 32);
        doc.text(`User: ${userId}`, 20, 38);
        if (siteIds?.length)
            doc.text(`Sites: ${siteIds.join(", ")}`, 20, 44);
        doc.setFontSize(9);
        doc.setTextColor(120);
        doc.text("Growteq Farm Management System", 20, doc.internal.pageSize.getHeight() - 10);
        fs_1.default.writeFileSync(filePath, Buffer.from(doc.output("arraybuffer")));
    }
    else {
        const header = "Report Type,Generated At,Site IDs\n";
        const row = `${reportType},${new Date().toISOString().slice(0, 10)},${(siteIds ?? []).join(";")}\n`;
        fs_1.default.writeFileSync(filePath, header + row, "utf8");
    }
    const downloadUrl = `/api/reports/download/${fileName}`;
    res.status(201).json({
        success: true,
        data: { fileName, downloadUrl },
    });
});
