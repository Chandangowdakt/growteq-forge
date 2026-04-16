/**
 * Create or recover admin login (does not wipe farms/sites — unlike seed.ts).
 *
 * Examples (from `backend/` so `.env` loads):
 *   pnpm exec tsx src/scripts/ensureAdminUser.ts admin123
 *   pnpm exec tsx src/scripts/ensureAdminUser.ts --reset admin123
 *   ENSURE_ADMIN_EMAIL=you@corp.com pnpm exec tsx src/scripts/ensureAdminUser.ts --reset newpass
 *
 * Env (optional): ENSURE_ADMIN_EMAIL, ENSURE_ADMIN_PASSWORD, ENSURE_ADMIN_NAME
 */
import dotenv from "dotenv"
import mongoose from "mongoose"
import { User } from "../models/User"
import { UserRequest } from "../models/UserRequest"

dotenv.config()

function parseArgs(): { email: string; password: string; reset: boolean } {
  const raw = process.argv.slice(2)
  const reset = raw.includes("--reset")
  const positional = raw.filter((a) => a !== "--reset")

  let email = (process.env.ENSURE_ADMIN_EMAIL ?? "admin@growteq.com").toLowerCase().trim()
  let password = process.env.ENSURE_ADMIN_PASSWORD ?? process.env.ADMIN_PASSWORD ?? ""

  if (!password && positional.length >= 2 && positional[0].includes("@")) {
    email = positional[0].toLowerCase().trim()
    password = positional[1]
  } else if (!password && positional.length >= 1) {
    const first = positional[0]
    if (first.includes("@") && positional[1]) {
      email = first.toLowerCase().trim()
      password = positional[1]
    } else if (!first.includes("@")) {
      password = first
    }
  }

  return { email, password, reset }
}

async function main(): Promise<void> {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    console.error("MONGODB_URI is required (set in backend/.env)")
    process.exit(1)
  }

  const { email, password, reset } = parseArgs()
  if (!password || String(password).length < 6) {
    console.error("Password required (min 6 chars). Examples:")
    console.error('  pnpm exec tsx src/scripts/ensureAdminUser.ts admin123')
    console.error('  pnpm exec tsx src/scripts/ensureAdminUser.ts --reset admin123')
    process.exit(1)
  }

  const name = (process.env.ENSURE_ADMIN_NAME ?? "Admin User").trim() || "Admin User"

  await mongoose.connect(uri)
  try {
    const existing = await User.findOne({ email })
    if (existing) {
      if (!reset) {
        console.log("User already exists:", email)
        console.log("To set password to a new value, run with --reset, e.g.:")
        console.error("  pnpm exec tsx src/scripts/ensureAdminUser.ts --reset <new-password>")
        process.exit(0)
      }
      existing.password = String(password)
      existing.role = "admin"
      existing.isActive = true
      if (!existing.name?.trim()) existing.name = name
      await existing.save()
      console.log("Updated admin password and role for:", email)
    } else {
      await User.create({
        email,
        password: String(password),
        name,
        role: "admin",
        isActive: true,
      })
      console.log("Created admin User:", email)
    }

    const reqDoc = await UserRequest.findOne({ email })
    if (reqDoc && reqDoc.status !== "approved") {
      reqDoc.status = "approved"
      await reqDoc.save()
      console.log("Updated matching UserRequest to approved for:", email)
    }
  } finally {
    await mongoose.disconnect()
  }
}

void main().catch((e: unknown) => {
  console.error(e)
  process.exit(1)
})
