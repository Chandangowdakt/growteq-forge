"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveInfrastructure = exports.getInfrastructure = exports.removeTeamMember = exports.updateTeamMember = exports.addTeamMember = exports.listTeam = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const User_1 = require("../models/User");
const ApiError_1 = require("../utils/ApiError");
const asyncHandler_1 = require("../utils/asyncHandler");
const INFRASTRUCTURE_JSON = path_1.default.join(__dirname, "..", "config", "infrastructure.json");
const DEFAULT_INFRASTRUCTURE = {
    polyhouse: { minCostPerAcre: 2500000, maxCostPerAcre: 3500000, roiMonths: 18 },
    shade_net: { minCostPerAcre: 200000, maxCostPerAcre: 500000, roiMonths: 6 },
    open_field: { minCostPerAcre: 50000, maxCostPerAcre: 200000, roiMonths: 3 },
};
exports.listTeam = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const users = await User_1.User.find({})
        .select("name email role isActive createdAt")
        .sort({ createdAt: -1 })
        .lean();
    const data = users.map((u) => ({
        _id: u._id,
        name: u.name,
        email: u.email,
        role: u.role ?? "user",
        status: u.isActive !== false ? "active" : "inactive",
        createdAt: u.createdAt,
    }));
    res.json({ success: true, data });
});
exports.addTeamMember = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { name, email, role } = req.body;
    if (!name?.trim() || !email?.trim()) {
        throw new ApiError_1.ApiError(400, "name and email are required");
    }
    const existing = await User_1.User.findOne({ email: email.trim().toLowerCase() });
    if (existing) {
        throw new ApiError_1.ApiError(400, "User with this email already exists");
    }
    const user = await User_1.User.create({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password: "changeme123",
        role: role === "admin" ? "admin" : "user",
        isActive: true,
    });
    res.status(201).json({
        success: true,
        data: {
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            status: "active",
        },
    });
});
exports.updateTeamMember = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.params.userId;
    const { role, status } = req.body;
    const update = {};
    if (role === "admin" || role === "user")
        update.role = role;
    if (status === "active" || status === "inactive")
        update.isActive = status === "active";
    const user = await User_1.User.findByIdAndUpdate(userId, { $set: update }, { new: true, runValidators: true }).select("name email role isActive");
    if (!user)
        throw new ApiError_1.ApiError(404, "User not found");
    res.json({
        success: true,
        data: {
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            status: user.isActive !== false ? "active" : "inactive",
        },
    });
});
exports.removeTeamMember = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.params.userId;
    const currentUserId = req.auth.userId;
    if (userId === currentUserId) {
        throw new ApiError_1.ApiError(400, "Cannot remove yourself");
    }
    const user = await User_1.User.findByIdAndDelete(userId);
    if (!user)
        throw new ApiError_1.ApiError(404, "User not found");
    res.json({ success: true, message: "Team member removed" });
});
exports.getInfrastructure = (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
    let data = DEFAULT_INFRASTRUCTURE;
    if (fs_1.default.existsSync(INFRASTRUCTURE_JSON)) {
        try {
            const raw = fs_1.default.readFileSync(INFRASTRUCTURE_JSON, "utf8");
            data = { ...DEFAULT_INFRASTRUCTURE, ...JSON.parse(raw) };
        }
        catch {
            // use defaults on parse error
        }
    }
    res.json({ success: true, data });
});
exports.saveInfrastructure = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const body = req.body;
    const dir = path_1.default.dirname(INFRASTRUCTURE_JSON);
    if (!fs_1.default.existsSync(dir))
        fs_1.default.mkdirSync(dir, { recursive: true });
    const current = fs_1.default.existsSync(INFRASTRUCTURE_JSON)
        ? JSON.parse(fs_1.default.readFileSync(INFRASTRUCTURE_JSON, "utf8"))
        : DEFAULT_INFRASTRUCTURE;
    const data = {
        polyhouse: { ...current.polyhouse, ...body.polyhouse },
        shade_net: { ...current.shade_net, ...body.shade_net },
        open_field: { ...current.open_field, ...body.open_field },
    };
    fs_1.default.writeFileSync(INFRASTRUCTURE_JSON, JSON.stringify(data, null, 2), "utf8");
    res.json({ success: true, data });
});
