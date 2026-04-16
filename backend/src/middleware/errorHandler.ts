import { Request, Response, NextFunction } from "express"
import { ApiError } from "../utils/ApiError"
import { env } from "../config/env"

/** express.json / body-parser rejects malformed JSON with 400 — map to client-friendly response. */
function isMalformedJsonBody(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  const e = err as Error & { status?: number; statusCode?: number; type?: string }
  if (e.status === 400 && e.type === "entity.parse.failed") return true
  if (e instanceof SyntaxError && "body" in e) return true
  const msg = e.message.toLowerCase()
  return msg.includes("json") && (msg.includes("unexpected") || msg.includes("invalid"))
}

export function errorHandler(
  err: Error | ApiError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (isMalformedJsonBody(err)) {
    res.status(400).json({ success: false, error: "Invalid JSON body" })
    return
  }
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
