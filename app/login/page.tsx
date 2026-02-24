"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import { useAuth } from "@/app/context/auth-context"
import { ApiError } from "@/lib/api"

export default function LoginPage() {
  const router = useRouter()
  const { login } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)
    try {
      await login(email, password)
      router.push("/dashboard/placeholder")
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F3EE] p-4">
      <div className="w-full max-w-md">
        <div className="mb-10 flex justify-center">
          <img src="/images/growteq-logo.svg" alt="Growteq Agri Farms" className="w-full max-w-[240px] h-auto" />
        </div>

        <div className="bg-white rounded-3xl shadow-xl p-8 md:p-12 border border-[#E8E5DF]">
          <div className="mb-8 text-center">
            <h1 className="text-4xl font-bold text-[#2B2B2B] mb-3">Login</h1>
            <p className="text-[#6B7280] text-lg">Please enter your login credentials</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-[#2B2B2B]">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email id"
                className="h-10 rounded-md border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-shadow md:text-sm"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-[#2B2B2B]">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="h-10 rounded-md border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-shadow md:text-sm"
                required
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{error}</p>
            )}
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-14 bg-[#387F43] hover:bg-[#2d6535] text-white text-lg font-semibold rounded-xl shadow-md transition-all hover:shadow-lg hover:scale-[1.01] disabled:opacity-50 disabled:hover:scale-100"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Logging in...
                </span>
              ) : (
                "Log in"
              )}
            </Button>
          </form>

          <div className="mt-8 text-center">
            <Link
              href="/forgot-password"
              className="text-[#387F43] hover:text-[#2d6535] font-medium text-base underline transition-colors"
            >
              Forgot Password
            </Link>
          </div>
        </div>

        <p className="text-center text-sm text-[#8B8680] mt-8">
          © 2025 Growteq Agri Farms Pvt Ltd. All rights reserved.
        </p>
      </div>
    </div>
  )
}
