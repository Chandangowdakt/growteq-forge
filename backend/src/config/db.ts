import mongoose from "mongoose"

export async function connectDb(): Promise<void> {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error("MONGODB_URI is not defined")
  try {
    await mongoose.connect(uri)
    console.log("MongoDB connected")
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("MongoDB connection failed:", message)
    throw err
  }
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect()
  console.log("[DB] MongoDB disconnected")
}
