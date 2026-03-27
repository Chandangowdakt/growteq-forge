"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/app/context/auth-context"
import { ApiError } from "@/lib/api"

const BRAND_GREEN = "#15803d"

function loginErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    const status = err.statusCode
    const message = (err.message || "").toLowerCase()

    if (status === 403) {
      return "Your account is pending approval or has been rejected. Please contact your admin."
    }
    if (status === 401) {
      if (message.includes("password") && !message.includes("email")) {
        return "Incorrect password. Please try again."
      }
      if (
        message.includes("not found") ||
        message.includes("no account") ||
        message.includes("unknown user") ||
        message.includes("user not")
      ) {
        return "No account found with this email address."
      }
      if (message.includes("email")) {
        return "No account found with this email address."
      }
      return "Invalid email or password. Please check your credentials."
    }
    if (status === 400) {
      return err.message || "Please check your email and password."
    }
    return err.message || "Login failed. Please try again."
  }
  if (err instanceof Error) {
    if (err.message.toLowerCase().includes("network")) {
      return "Unable to connect to server. Please check your internet connection."
    }
    return err.message
  }
  return "Unable to connect to server. Please check your internet connection."
}

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
      router.push("/dashboard/overview")
    } catch (err) {
      setError(loginErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#ede8dc] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <img
            src="/images/growteq-logo.svg"
            alt="Growteq Agri Farms Pvt Ltd"
            className="h-16 w-auto"
          />
        </div>

        <div className="bg-white rounded-xl shadow-md border p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-gray-900">Welcome back</h2>
            <p className="text-muted-foreground mt-1">Sign in to your account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full"
                required
              />
            </div>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
                {error}
              </div>
            )}
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 text-base font-medium disabled:opacity-70 disabled:cursor-not-allowed"
              style={{ backgroundColor: BRAND_GREEN }}
            >
              {isLoading ? (
                <span className="flex flex-col items-center justify-center gap-1">
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
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
                    Signing in…
                  </span>
                  <span className="text-xs font-normal text-white/90">Connecting to server…</span>
                </span>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="font-medium" style={{ color: BRAND_GREEN }}>
              Register
            </Link>
          </p>
        </div>
      </div>
      <p className="mt-8 text-sm text-gray-500 text-center">
        © 2026 Growteq Agri Farms Pvt Ltd. All rights reserved.
      </p>
    </div>
  )
}
