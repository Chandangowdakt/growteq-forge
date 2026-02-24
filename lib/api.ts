/**
 * Forge API client — axios instance for backend (NEXT_PUBLIC_API_URL).
 * Token from localStorage "forge_token" for authenticated requests.
 */

import axios, { type AxiosError } from "axios"

const baseURL =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL) ||
  "http://localhost:5000"

export const api = axios.create({
  baseURL,
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
})

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("forge_token")
    if (token) config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err: AxiosError<{ error?: string }>) => {
    const message =
      err.response?.data?.error ?? err.message ?? "Request failed"
    const status = err.response?.status ?? 500
    throw new ApiError(status, message, err.response?.data)
  }
)

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public data?: unknown
  ) {
    super(message)
    this.name = "ApiError"
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  params?: Record<string, string>
): Promise<T> {
  const res = await api.request<T>({ method, url: path, data: body, params })
  return res.data
}

// Auth
export interface AuthUser {
  id: string
  email: string
  name: string
  role: "admin" | "user"
}

export interface LoginResponse {
  success: boolean
  data: { user: AuthUser; token: string }
}

export const authApi = {
  login: (email: string, password: string) =>
    request<LoginResponse>("POST", "/api/auth/login", { email, password }),
  register: (
    email: string,
    password: string,
    name: string,
    role?: "admin" | "user"
  ) =>
    request<LoginResponse>("POST", "/api/auth/register", {
      email,
      password,
      name,
      role,
    }),
  me: () => request<{ success: boolean; data: { user: AuthUser } }>("GET", "/api/auth/me"),
}

// Farms
export interface Farm {
  _id: string
  name: string
  description?: string
  location?: string
  userId: string
  createdAt: string
  updatedAt: string
}

export const farmsApi = {
  list: () => request<{ success: boolean; data: Farm[] }>("GET", "/api/farms"),
  create: (body: { name: string; description?: string; location?: string }) =>
    request<{ success: boolean; data: Farm }>("POST", "/api/farms", body),
  get: (id: string) =>
    request<{ success: boolean; data: Farm }>("GET", `/api/farms/${id}`),
  update: (id: string, body: Partial<Farm>) =>
    request<{ success: boolean; data: Farm }>("PATCH", `/api/farms/${id}`, body),
  delete: (id: string) =>
    request<{ success: boolean; message: string }>("DELETE", `/api/farms/${id}`),
}

// Site evaluations
export interface PolygonPoint {
  lat: number
  lng: number
  id: string
}

export interface SiteEvaluation {
  _id: string
  name: string
  userId: string
  farmId?: string
  boundary: PolygonPoint[]
  area: number
  areaUnit: "acres" | "sqmeters"
  slope?: number
  infrastructureRecommendation?: string
  costEstimate?: number
  costCurrency?: string
  status: "draft" | "submitted"
  createdAt: string
  updatedAt: string
}

export const siteEvaluationsApi = {
  list: (farmId?: string) =>
    request<{ success: boolean; data: SiteEvaluation[] }>(
      "GET",
      "/api/site-evaluations",
      undefined,
      farmId ? { farmId } : undefined
    ),
  create: (body: Partial<SiteEvaluation> & { name: string; area: number }) =>
    request<{ success: boolean; data: SiteEvaluation }>(
      "POST",
      "/api/site-evaluations",
      body
    ),
  get: (id: string) =>
    request<{ success: boolean; data: SiteEvaluation }>(
      "GET",
      `/api/site-evaluations/${id}`
    ),
  update: (id: string, body: Partial<SiteEvaluation>) =>
    request<{ success: boolean; data: SiteEvaluation }>(
      "PATCH",
      `/api/site-evaluations/${id}`,
      body
    ),
  delete: (id: string) =>
    request<{ success: boolean; message: string }>(
      "DELETE",
      `/api/site-evaluations/${id}`
    ),
}

// Proposals
export interface Proposal {
  _id: string
  title: string
  siteEvaluationId: string
  userId: string
  content: Record<string, unknown>
  status: "draft" | "sent"
  createdAt: string
  updatedAt: string
}

export const proposalsApi = {
  list: () =>
    request<{ success: boolean; data: Proposal[] }>("GET", "/api/proposals"),
  create: (body: {
    title: string
    siteEvaluationId: string
    content?: Record<string, unknown>
  }) =>
    request<{ success: boolean; data: Proposal }>("POST", "/api/proposals", body),
  get: (id: string) =>
    request<{ success: boolean; data: Proposal }>("GET", `/api/proposals/${id}`),
  update: (id: string, body: Partial<Proposal>) =>
    request<{ success: boolean; data: Proposal }>(
      "PATCH",
      `/api/proposals/${id}`,
      body
    ),
}

// Notifications
export interface NotificationItem {
  _id: string
  userId: string
  user?: { name: string; avatar?: string }
  action: string
  content: string
  isRead: boolean
  isNew: boolean
  createdAt: string
  updatedAt: string
}

export const notificationsApi = {
  list: () =>
    request<{ success: boolean; data: NotificationItem[] }>(
      "GET",
      "/api/notifications"
    ),
  markAsRead: (id: string) =>
    request<{ success: boolean; data: NotificationItem }>(
      "PATCH",
      `/api/notifications/${id}/read`
    ),
  markAllAsRead: () =>
    request<{ success: boolean; message: string }>(
      "POST",
      "/api/notifications/read-all"
    ),
}

// Dashboard summary
export const dashboardApi = {
  async summary() {
    const [farmsRes, evaluationsRes] = await Promise.all([
      farmsApi.list(),
      siteEvaluationsApi.list(),
    ])
    const farms = farmsRes.data
    const evaluations = evaluationsRes.data
    const draftCount = evaluations.filter((e) => e.status === "draft").length
    const submittedCount = evaluations.filter(
      (e) => e.status === "submitted"
    ).length
    const totalArea = evaluations.reduce((sum, e) => sum + (e.area ?? 0), 0)
    return {
      activeSites: evaluations.length,
      draftEvaluations: draftCount,
      submitted: submittedCount,
      totalLandArea: totalArea,
      farms,
      evaluations,
    }
  },
}
