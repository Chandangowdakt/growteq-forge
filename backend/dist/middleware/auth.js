"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = authMiddleware;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const ApiError_1 = require("../utils/ApiError");
const env_1 = require("../config/env");
const User_1 = require("../models/User");
async function authMiddleware(req, _res, next) {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
        if (!token) {
            throw new ApiError_1.ApiError(401, "Authentication required");
        }
        const decoded = jsonwebtoken_1.default.verify(token, env_1.env.jwtSecret);
        const user = await User_1.User.findById(decoded.userId);
        if (!user) {
            throw new ApiError_1.ApiError(401, "User not found");
        }
        req.auth = decoded;
        req.user = user;
        next();
    }
    catch (err) {
        if (err instanceof ApiError_1.ApiError)
            next(err);
        else if (err instanceof jsonwebtoken_1.default.JsonWebTokenError)
            next(new ApiError_1.ApiError(401, "Invalid token"));
        else
            next(err);
    }
}
