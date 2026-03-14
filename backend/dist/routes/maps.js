"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const mapsController_1 = require("../controllers/mapsController");
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware);
router.post("/snapshot", mapsController_1.createMapSnapshot);
exports.default = router;
