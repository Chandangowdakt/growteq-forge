import mongoose from "mongoose"

export async function connectDb(): Promise<void> {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error("MONGODB_URI is not defined")
  await mongoose.connect(uri)
  console.log("MongoDB connected")
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect()
  console.log("[DB] MongoDB disconnected")
}
