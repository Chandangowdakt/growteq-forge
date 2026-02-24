import { Router, type IRouter } from "express"
import { register, login, me } from "../controllers/authController"
import { authMiddleware } from "../middleware/auth"

const router: IRouter = Router()

router.post("/register", register)
router.post("/login", login)
router.get("/me", authMiddleware, me)

export default router
