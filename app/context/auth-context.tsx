"use client"

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react"
import { authApi, type AuthUser } from "@/lib/api"

const FORGE_TOKEN_KEY = "forge_token"

type AuthContextType = {
  user: AuthUser | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  setUser: (user: AuthUser | null) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const setUser = useCallback((u: AuthUser | null) => {
    setUserState(u)
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const res = await authApi.login(email, password)
    if (res.success && res.data.token) {
      typeof window !== "undefined" && localStorage.setItem(FORGE_TOKEN_KEY, res.data.token)
      setUserState(res.data.user)
    }
  }, [])

  const logout = useCallback(() => {
    typeof window !== "undefined" && localStorage.removeItem(FORGE_TOKEN_KEY)
    setUserState(null)
  }, [])

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem(FORGE_TOKEN_KEY) : null
    if (!token) {
      setIsLoading(false)
      return
    }
    authApi
      .me()
      .then((r) => {
        if (r.success && r.data.user) setUserState(r.data.user)
      })
      .catch(() => {
        localStorage.removeItem(FORGE_TOKEN_KEY)
      })
      .finally(() => setIsLoading(false))
  }, [])

  const value: AuthContextType = { user, isLoading, login, logout, setUser }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (ctx === undefined) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
