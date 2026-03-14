"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestLogger = requestLogger;
function requestLogger(req, res, next) {
    const start = Date.now();
    res.on("finish", () => {
        const duration = Date.now() - start;
        const method = req.method;
        const url = req.originalUrl;
        const status = res.statusCode;
        console.log(`[REQ] ${method} ${url} ${status} - ${duration}ms`);
    });
    next();
}
