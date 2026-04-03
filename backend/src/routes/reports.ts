import { Router, type IRouter } from "express"
import { authMiddleware } from "../middleware/auth"
import { checkPermission } from "../middleware/permissionMiddleware"
import {
  listReports,
  listReportFiles,
  listReportTypes,
  generateReport,
  generateFarmReport,
  generateProposalReport,
  downloadReport,
  deleteReport,
  downloadSiteEvaluationPdfBySite,
  downloadMultiSiteEvaluationPdf,
  exportEvaluationsDataTableCsv,
  exportMapDataJson,
} from "../controllers/reportsController"

const router: IRouter = Router()

router.use(authMiddleware)

router.get("/", checkPermission("reports", "read"), listReports)
router.get("/files", checkPermission("reports", "read"), listReportFiles)
router.get("/list", checkPermission("reports", "read"), listReportTypes)
router.post("/generate", checkPermission("reports", "write"), generateReport)
router.get(
  "/site-evaluation/:siteId",
  checkPermission("reports", "write"),
  downloadSiteEvaluationPdfBySite
)
router.get(
  "/single-site/:siteId",
  checkPermission("reports", "write"),
  downloadSiteEvaluationPdfBySite
)
router.post("/multi-site", checkPermission("reports", "write"), downloadMultiSiteEvaluationPdf)
router.get("/export/data-table", checkPermission("reports", "write"), exportEvaluationsDataTableCsv)
router.get("/export/map-data", checkPermission("reports", "write"), exportMapDataJson)
router.get("/download/:fileName", checkPermission("reports", "read"), downloadReport)
router.delete("/:fileName", checkPermission("reports", "write"), deleteReport)
router.post("/farm/:farmId", checkPermission("reports", "write"), generateFarmReport)
router.post("/proposal/:proposalId", checkPermission("reports", "write"), generateProposalReport)

export default router

