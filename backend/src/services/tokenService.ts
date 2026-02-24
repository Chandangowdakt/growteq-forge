import jwt from "jsonwebtoken"
import type { SignOptions } from "jsonwebtoken"
import { env } from "../config/env"

export function signToken(payload: { userId: string; email: string; role: string }): string {
  return jwt.sign(payload, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn as string | number,
  } as SignOptions)
}

export function verifyToken(token: string): { userId: string; email: string; role: string } {
  return jwt.verify(token, env.jwtSecret) as { userId: string; email: string; role: string }
}
