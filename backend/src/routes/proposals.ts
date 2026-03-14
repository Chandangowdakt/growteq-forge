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

const router: IRouter = Router()

router.use(authMiddleware)

router.get("/", listProposals)
router.post("/", createProposal)
router.post("/recommend", recommendInfrastructure)
router.post("/save", saveInfrastructureProposal)
router.get("/site/:siteId", getProposalsForSite)
router.get("/farm/:farmId", getProposalsForFarm)
router.get("/:id", getProposal)
router.patch("/:id", updateProposal)
router.get("/:id/pdf", getProposalPdf)

export default router
