import { Router, type IRouter } from "express"
import {
  listProposals,
  createProposal,
  getProposal,
  updateProposal,
  getProposalPdf,
} from "../controllers/proposalController"
import { authMiddleware } from "../middleware/auth"

const router: IRouter = Router()

router.use(authMiddleware)

router.get("/", listProposals)
router.post("/", createProposal)
router.get("/:id", getProposal)
router.patch("/:id", updateProposal)
router.get("/:id/pdf", getProposalPdf)

export default router
