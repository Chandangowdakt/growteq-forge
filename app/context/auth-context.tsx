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
const FORGE_USER_KEY = "forge_user"

type AuthContextType = {
  user: AuthUser | null
  token: string | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  setUser: (user: AuthUser | null) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<AuthUser | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const setUser = useCallback((u: AuthUser | null) => {
    setUserState(u)
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const res = await authApi.login(email, password)
    if (res.success && res.data.token) {
      const t = res.data.token
      const u = res.data.user
      if (typeof window !== "undefined") {
        localStorage.setItem(FORGE_TOKEN_KEY, t)
        localStorage.setItem(FORGE_USER_KEY, JSON.stringify(u))
      }
      setToken(t)
      setUserState(u)
    }
  }, [])

  const logout = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(FORGE_TOKEN_KEY)
      localStorage.removeItem(FORGE_USER_KEY)
      window.location.href = "/login"
    }
    setToken(null)
    setUserState(null)
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") {
      setIsLoading(false)
      return
    }
    const storedToken = localStorage.getItem(FORGE_TOKEN_KEY)
    const storedUser = localStorage.getItem(FORGE_USER_KEY)
    if (storedUser) {
      try {
        setUserState(JSON.parse(storedUser) as AuthUser)
      } catch {
        // ignore
      }
    }
    if (storedToken) setToken(storedToken)
    if (!storedToken) {
      setIsLoading(false)
      return
    }
    authApi
      .me()
      .then((r) => {
        if (r.success && r.data.user) {
          setUserState(r.data.user)
          localStorage.setItem(FORGE_USER_KEY, JSON.stringify(r.data.user))
        }
      })
      .catch(() => {
        localStorage.removeItem(FORGE_TOKEN_KEY)
        localStorage.removeItem(FORGE_USER_KEY)
        setUserState(null)
        setToken(null)
      })
      .finally(() => setIsLoading(false))
  }, [])

  const value: AuthContextType = {
    user,
    token,
    isLoading,
    isAuthenticated: !!token && !!user,
    login,
    logout,
    setUser,
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (ctx === undefined) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
