"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
const ApiError_1 = require("../utils/ApiError");
const env_1 = require("../config/env");
function errorHandler(err, _req, res, _next) {
    const isApiError = err instanceof ApiError_1.ApiError;
    const statusCode = isApiError ? err.statusCode : 500;
    const message = isApiError ? err.message : "Internal server error";
    console.error("[ERROR]", {
        message: err.message,
        stack: env_1.env.nodeEnv === "development" ? err.stack : undefined,
        status: statusCode,
    });
    res.status(statusCode).json({ success: false, error: message });
}
