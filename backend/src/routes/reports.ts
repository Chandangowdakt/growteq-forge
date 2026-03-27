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
} from "../controllers/reportsController"

const router: IRouter = Router()

router.use(authMiddleware)

router.get("/", checkPermission("reports", "read"), listReports)
router.get("/files", checkPermission("reports", "read"), listReportFiles)
router.get("/list", checkPermission("reports", "read"), listReportTypes)
router.post("/generate", checkPermission("reports", "write"), generateReport)
router.get("/download/:fileName", checkPermission("reports", "read"), downloadReport)
router.delete("/:fileName", checkPermission("reports", "write"), deleteReport)
router.post("/farm/:farmId", checkPermission("reports", "write"), generateFarmReport)
router.post("/proposal/:proposalId", checkPermission("reports", "write"), generateProposalReport)

export default router

