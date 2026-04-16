/**
 * One-off: create an admin User if missing (production / fresh Atlas).
 * Does not wipe data (unlike seed.ts).
 *
 * Render shell (example):
 *   ENSURE_ADMIN_PASSWORD='your-secure-password' pnpm exec tsx src/scripts/ensureAdminUser.ts
 *
 * Optional: ENSURE_ADMIN_EMAIL, ENSURE_ADMIN_NAME
 */
import dotenv from "dotenv"
import mongoose from "mongoose"
import { User } from "../models/User"
import { UserRequest } from "../models/UserRequest"

dotenv.config()

async function main(): Promise<void> {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    console.error("MONGODB_URI is required")
    process.exit(1)
  }
  const email = (process.env.ENSURE_ADMIN_EMAIL ?? "admin@growteq.com").toLowerCase().trim()
  const password = process.env.ENSURE_ADMIN_PASSWORD ?? process.env.ADMIN_PASSWORD
  if (!password || String(password).length < 6) {
    console.error("Set ENSURE_ADMIN_PASSWORD (or ADMIN_PASSWORD) with at least 6 characters.")
    process.exit(1)
  }

  await mongoose.connect(uri)
  try {
    const existing = await User.findOne({ email })
    if (existing) {
      console.log("Admin user already exists:", email)
      return
    }

    await User.create({
      email,
      password: String(password),
      name: (process.env.ENSURE_ADMIN_NAME ?? "Admin User").trim() || "Admin User",
      role: "admin",
      isActive: true,
    })
    console.log("Created admin User:", email)

    const reqDoc = await UserRequest.findOne({ email })
    if (reqDoc?.status === "pending") {
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
