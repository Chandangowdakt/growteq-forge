"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.me = exports.login = exports.register = void 0;
const User_1 = require("../models/User");
const ApiError_1 = require("../utils/ApiError");
const asyncHandler_1 = require("../utils/asyncHandler");
const tokenService_1 = require("../services/tokenService");
function nameToFirstLast(name) {
    const parts = (name || "").trim().split(/\s+/);
    const firstName = parts[0] ?? "User";
    const lastName = parts.slice(1).join(" ") ?? "";
    return { firstName, lastName };
}
exports.register = (0, asyncHandler_1.asyncHandler)(async (req, res, _next) => {
    const { email, password, firstName, lastName, name, role } = req.body;
    const fullName = [firstName, lastName].filter(Boolean).join(" ") || name;
    if (!email || !password || !fullName?.trim()) {
        throw new ApiError_1.ApiError(400, "Email, password and name (or firstName + lastName) are required");
    }
    const existing = await User_1.User.findOne({ email: String(email).toLowerCase().trim() });
    if (existing) {
        throw new ApiError_1.ApiError(400, "Email already registered");
    }
    const user = await User_1.User.create({
        email: String(email).toLowerCase().trim(),
        password: String(password),
        name: fullName.trim(),
        role: role === "admin" ? "admin" : "user",
    });
    const token = (0, tokenService_1.signToken)({ userId: user._id.toString(), email: user.email, role: user.role });
    const { firstName: fn, lastName: ln } = nameToFirstLast(user.name);
    res.status(201).json({
        success: true,
        data: {
            token,
            user: { id: user._id, email: user.email, firstName: fn, lastName: ln, role: user.role },
        },
    });
});
exports.login = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        throw new ApiError_1.ApiError(400, "Email and password are required");
    }
    const user = await User_1.User.findOne({ email: String(email).toLowerCase().trim() }).select("+password");
    if (!user || !(await user.comparePassword(String(password)))) {
        throw new ApiError_1.ApiError(401, "Invalid email or password");
    }
    const token = (0, tokenService_1.signToken)({ userId: user._id.toString(), email: user.email, role: user.role });
    const { firstName, lastName } = nameToFirstLast(user.name);
    res.json({
        success: true,
        data: {
            token,
            user: { id: user._id, email: user.email, firstName, lastName, role: user.role },
        },
    });
});
exports.me = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const user = req.user;
    const { firstName, lastName } = nameToFirstLast(user.name);
    res.json({
        success: true,
        data: {
            user: { id: user._id, email: user.email, firstName, lastName, name: user.name, role: user.role },
        },
    });
});
