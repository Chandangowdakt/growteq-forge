import { Router, type IRouter } from "express"
import { authMiddleware } from "../middleware/auth"
import {
  listReports,
  listReportTypes,
  generateReport,
  generateFarmReport,
  generateProposalReport,
  downloadReport,
  deleteReport,
} from "../controllers/reportsController"

const router: IRouter = Router()

router.use(authMiddleware)

router.get("/", listReports)
router.get("/list", listReportTypes)
router.post("/generate", generateReport)
router.get("/download/:fileName", downloadReport)
router.delete("/:fileName", deleteReport)
router.post("/farm/:farmId", generateFarmReport)
router.post("/proposal/:proposalId", generateProposalReport)

export default router

