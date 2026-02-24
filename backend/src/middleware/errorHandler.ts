import { Request, Response, NextFunction } from "express"
import { ApiError } from "../utils/ApiError"
import { env } from "../config/env"

export function errorHandler(
  err: Error | ApiError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const isApiError = err instanceof ApiError
  const statusCode = isApiError ? err.statusCode : 500
  const message = isApiError ? err.message : "Internal server error"
  console.error("[ERROR]", {
    message: err.message,
    stack: env.nodeEnv === "development" ? err.stack : undefined,
    status: statusCode,
  })
  res.status(statusCode).json({ success: false, error: message })
}
