import { Router, type IRouter } from "express"
import { authMiddleware } from "../middleware/auth"
import { createMapSnapshot } from "../controllers/mapsController"

const router: IRouter = Router()

router.use(authMiddleware)

router.post("/snapshot", createMapSnapshot)

export default router

