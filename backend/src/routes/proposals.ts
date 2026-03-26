import { Router, type IRouter } from "express"
import {
  listProposals,
  createProposal,
  getProposal,
  updateProposal,
  getProposalPdf,
  recommendInfrastructure,
  saveInfrastructureProposal,
  getProposalsForSite,
  getProposalsForFarm,
} from "../controllers/proposalController"
import { authMiddleware } from "../middleware/auth"
import { checkPermission } from "../middleware/permissionMiddleware"

const router: IRouter = Router()

router.use(authMiddleware)

router.get("/", checkPermission("proposals", "read"), listProposals)
router.post("/", checkPermission("proposals", "write"), createProposal)
router.post("/recommend", checkPermission("proposals", "write"), recommendInfrastructure)
router.post("/save", checkPermission("proposals", "write"), saveInfrastructureProposal)
router.get("/site/:siteId", checkPermission("proposals", "read"), getProposalsForSite)
router.get("/farm/:farmId", checkPermission("proposals", "read"), getProposalsForFarm)
router.get("/:id", checkPermission("proposals", "read"), getProposal)
router.patch("/:id", checkPermission("proposals", "write"), updateProposal)
router.get("/:id/pdf", checkPermission("proposals", "read"), getProposalPdf)

export default router
