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
    if (!err.response) {
      // Network error - backend unreachable
      console.error("Network error - backend unreachable")
      // Don't redirect, let components handle it
      return Promise.reject(new Error("Network error. Please check your connection."))
    }
    if (err.response?.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("forge_token")
      localStorage.removeItem("forge_user")
      window.location.href = "/login"
    }
    const message =
      err.response?.data?.error ?? err.message ?? "Request failed"
    const status = err.response?.status ?? 500
    return Promise.reject(new ApiError(status, message, err.response?.data))
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

/** Effective permissions (matches backend modules). */
export type UserPermissionsMap = {
  farms: { read: boolean; write: boolean }
  sites: { read: boolean; write: boolean }
  evaluations: { read: boolean; write: boolean }
  proposals: { read: boolean; write: boolean }
  reports: { read: boolean; write: boolean }
  finance: { read: boolean; write: boolean }
  settings: { read: boolean; write: boolean }
}

// Auth
export interface AuthUser {
  id: string
  email: string
  name?: string
  firstName?: string
  lastName?: string
  role: "admin" | "editor" | "viewer" | "field_evaluator" | "sales_associate" | "user"
  permissions?: UserPermissionsMap
}

export interface LoginResponse {
  success: boolean
  data: { user: AuthUser; token: string }
}

export interface RegisterRequestResponse {
  success: boolean
  message?: string
  data: { submitted: true }
}

export const authApi = {
  login: (email: string, password: string) =>
    request<LoginResponse>("POST", "/api/auth/login", { email, password }),
  register: (
    firstName: string,
    lastName: string,
    email: string,
    password: string
  ) =>
    request<RegisterRequestResponse>("POST", "/api/auth/register", {
      firstName,
      lastName,
      email,
      password,
    }),
  me: () => request<{ success: boolean; data: { user: AuthUser } }>("GET", "/api/auth/me"),
}

// Farms
export interface Farm {
  _id: string
  name: string
  description?: string
  location?: string
  totalArea?: number
  country?: string
  state?: string
  district?: string
  userId: string
  siteCount?: number
  createdAt: string
  updatedAt: string
}

export const farmsApi = {
  list: () => request<{ success: boolean; data: Farm[] }>("GET", "/api/farms"),
  create: (body: {
    name: string
    location?: string
    totalArea?: number
    country?: string
    state?: string
    district?: string
  }) => request<{ success: boolean; data: Farm }>("POST", "/api/farms", body),
  get: (id: string) =>
    request<{ success: boolean; data: Farm }>("GET", `/api/farms/${id}`),
  getById: (id: string) =>
    request<{ success: boolean; data: Farm }>("GET", `/api/farms/${id}`),
  update: (id: string, body: Partial<Farm>) =>
    request<{ success: boolean; data: Farm }>("PUT", `/api/farms/${id}`, body),
  remove: (id: string) =>
    request<{ success: boolean; message: string }>("DELETE", `/api/farms/${id}`),
  delete: (id: string) =>
    request<{ success: boolean; message: string }>("DELETE", `/api/farms/${id}`),
  getSites: (id: string) =>
    request<{ success: boolean; data: { _id: string; name: string; area: number }[] }>(
      "GET",
      `/api/farms/${id}/sites`
    ),
}

// Site evaluations
export interface PolygonPoint {
  lat: number
  lng: number
  id: string
}

export interface InfrastructureSnapshot {
  type: "polyhouse" | "shade_net" | "open_field"
  minCost: number
  maxCost: number
  roiMonths: number
  configVersion?: number
}

export interface SiteEvaluation {
  _id: string
  siteId?: string | { _id: string; name?: string; area?: number }
  farmId?: string
  userId: string
  soilType?: string
  waterAvailability?: string
  slopePercentage?: number
  elevationMeters?: number
  sunExposure?: "full" | "partial" | "shade"
  status: "draft" | "submitted" | "approved" | "rejected"
  notes?: string
  boundary?: PolygonPoint[]
  area?: number
  areaUnit?: "acres" | "sqmeters"
  name?: string
  slope?: number
  infrastructureRecommendation?: string
  numberOfUnits?: number
  cropType?: string
  calculatedInvestment?: number
  infrastructureSnapshot?: InfrastructureSnapshot
  costEstimate?: number
  costCurrency?: string
  createdAt: string
  updatedAt: string
}

export interface SiteEvaluationCreateResponse {
  evaluation: SiteEvaluation
  proposal: { _id: string; infrastructureType?: string; investmentValue?: number; roiMonths?: number }
}

export const siteEvaluationsApi = {
  list: (params?: { farmId?: string; status?: string }) =>
    request<{ success: boolean; data: SiteEvaluation[] }>(
      "GET",
      "/api/site-evaluations",
      undefined,
      params as Record<string, string> | undefined
    ),
  create: (body: {
    siteId: string
    farmId: string
    soilType: string
    waterAvailability: string
    slopePercentage: number
    elevationMeters?: number
    sunExposure?: "full" | "partial" | "shade"
    notes?: string
    infrastructureType?: "polyhouse" | "shade_net" | "open_field"
    numberOfUnits?: number
    cropType?: string
    calculatedInvestment?: number
  }) =>
    request<{ success: boolean; data: SiteEvaluationCreateResponse }>(
      "POST",
      "/api/site-evaluations",
      body
    ),
  get: (id: string) =>
    request<{ success: boolean; data: SiteEvaluation & { proposal?: unknown } }>(
      "GET",
      `/api/site-evaluations/${id}`
    ),
  getById: (id: string) =>
    request<{ success: boolean; data: SiteEvaluation & { proposal?: unknown } }>(
      "GET",
      `/api/site-evaluations/${id}`
    ),
  updateStatus: (id: string, status: "submitted" | "approved" | "rejected") =>
    request<{ success: boolean; data: SiteEvaluation }>(
      "PATCH",
      `/api/site-evaluations/${id}/status`,
      { status }
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
  title?: string
  message?: string
  action: string
  content: string
  isRead: boolean
  isNew?: boolean
  createdAt: string
  updatedAt: string
}

export const notificationsApi = {
  list: () =>
    request<{ success: boolean; data: NotificationItem[] }>(
      "GET",
      "/api/notifications"
    ),
  unreadCount: () =>
    request<{ success: boolean; data: { count: number } }>(
      "GET",
      "/api/notifications/unread-count"
    ),
  markRead: (id: string) =>
    request<{ success: boolean; data: NotificationItem }>(
      "PUT",
      `/api/notifications/${id}/read`
    ),
  markAsRead: (id: string) =>
    request<{ success: boolean; data: NotificationItem }>(
      "PUT",
      `/api/notifications/${id}/read`
    ),
  markAllRead: () =>
    request<{ success: boolean; message: string }>(
      "PUT",
      "/api/notifications/read-all"
    ),
  remove: (id: string) =>
    request<{ success: boolean; message: string }>(
      "DELETE",
      `/api/notifications/${id}`
    ),
}

// Dashboard summary (backend API)
export interface DashboardSummary {
  totalSites: number
  totalArea: number
  totalProposals: number
  pipelineValue: number
  averageROI: number
  revenueTrend: { month: string; value: number }[]
}

export interface WorkInProgressItem {
  _id: string
  farmName: string
  siteName: string
  area: number
  status: string
  createdAt: string
  updatedAt: string
  boundaryPointCount: number
  completionPercentage: number
  proposalId: string | null
}

export const dashboardApi = {
  summary: () =>
    request<{ success: boolean; data: DashboardSummary }>("GET", "/api/dashboard/summary"),
  workInProgress: () =>
    request<{ success: boolean; data: WorkInProgressItem[] }>("GET", "/api/dashboard/work-in-progress"),
}

// Finance summary
export interface FinanceSummary {
  totalInvestment: number
  expectedROI: number
  avgROITimeline: number
  activeProposals: number
  costTrends: { month: string; polyhouse?: number; shade_net?: number; open_field?: number }[]
  comparison: { type: string; roiMonths: number; profitMargin: string; initialInvestmentPerAcre?: string }[]
}

export const financeApi = {
  summary: (params?: { siteId?: string }) =>
    request<{ success: boolean; data: FinanceSummary }>("GET", "/api/finance/summary", undefined, params as Record<string, string> | undefined),
}

// Reports
export interface ReportTypeItem {
  reportType: string
  lastGeneratedAt: string | null
  pdfFileName?: string | null
  excelFileName?: string | null
}

export interface GenerateReportResponse {
  fileName: string
  downloadUrl: string
}

export const reportsApi = {
  list: () =>
    request<{ success: boolean; data: ReportTypeItem[] }>("GET", "/api/reports/list"),
  generate: (body: { reportType: string; siteIds?: string[]; format: "pdf" | "excel" }) =>
    request<{ success: boolean; data: GenerateReportResponse }>("POST", "/api/reports/generate", body),
}

// Settings team
export interface TeamMember {
  _id: string
  name: string
  email: string
  role: string
  status: "active" | "inactive"
  createdAt?: string
  permissions?: UserPermissionsMap
}

/** Per-acre min/max cost (₹) and ROI timeline — single source: GET /api/settings/infrastructure */
export interface InfrastructureConfig {
  polyhouse: { minCost: number; maxCost: number; roiMonths: number }
  shade_net: { minCost: number; maxCost: number; roiMonths: number }
  open_field: { minCost: number; maxCost: number; roiMonths: number }
}

export const settingsApi = {
  listTeam: () =>
    request<{ success: boolean; data: TeamMember[] }>("GET", "/api/settings/team"),
  addTeamMember: (body: { name: string; email: string; role?: string }) =>
    request<{ success: boolean; data: TeamMember }>("POST", "/api/settings/team", body),
  updateTeamMember: (
    userId: string,
    body: { role?: string; status?: string; permissions?: Partial<UserPermissionsMap> }
  ) =>
    request<{ success: boolean; data: TeamMember }>("PUT", `/api/settings/team/${userId}`, body),
  removeTeamMember: (userId: string) =>
    request<{ success: boolean; message: string }>("DELETE", `/api/settings/team/${userId}`),
  getInfrastructure: () =>
    request<{ success: boolean; data: InfrastructureConfig }>("GET", "/api/settings/infrastructure"),
  saveInfrastructure: (body: Partial<InfrastructureConfig>) =>
    request<{ success: boolean; data: InfrastructureConfig }>("POST", "/api/settings/infrastructure", body),
}

export interface UserRequestRow {
  _id: string
  name: string
  email: string
  requestedRole: string | null
  status: string
  createdAt: string
}

export const userRequestsApi = {
  listPending: () =>
    request<{ success: boolean; data: UserRequestRow[] }>("GET", "/api/user-requests"),
  approve: (
    id: string,
    body: { role: string; permissions?: Partial<UserPermissionsMap> }
  ) =>
    request<{ success: boolean; data: { user: TeamMember } }>(
      "POST",
      `/api/user-requests/${id}/approve`,
      body
    ),
  reject: (id: string) =>
    request<{ success: boolean; data: { message: string } }>(
      "POST",
      `/api/user-requests/${id}/reject`,
      {}
    ),
}

export const inviteApi = {
  send: (body: { email: string; role?: string; permissions?: Partial<UserPermissionsMap> }) =>
    request<{ success: boolean; data: { email: string; role: string; expiresAt: string } }>(
      "POST",
      "/api/invite",
      body
    ),
  accept: (body: { token: string; name: string; password: string }) =>
    request<{ success: boolean; data: { message: string; email: string } }>(
      "POST",
      "/api/invite/accept",
      body
    ),
}

export interface AuditLogRow {
  _id: string
  userId: string
  userName: string | null
  userEmail: string | null
  action: string
  module: string
  entityId: string | null
  before: unknown
  after: unknown
  ipAddress: string | null
  createdAt: string
}

export const auditApi = {
  listLogs: (params?: { module?: string; userId?: string; from?: string; to?: string; limit?: string }) =>
    request<{ success: boolean; data: AuditLogRow[] }>(
      "GET",
      "/api/audit/logs",
      undefined,
      params as Record<string, string> | undefined
    ),
}

// Insights (use backend base URL — api instance already sends Bearer token)
export interface PipelineByMonth {
  month: string
  approved: number
  drafted: number
  submitted: number
}

export interface PipelineData {
  totalPipelineValue?: number
  proposalCount?: number
  byMonth?: PipelineByMonth[]
}

export interface SiteRankingEntry {
  siteId: string
  siteName?: string
  area: number
  score?: number
  roiMonths?: number | null
  infrastructureType?: string | null
}

export interface RoiDistributionEntry {
  month: number
  polyhouse: number
  shade_net: number
  open_field: number
}

export const insightsApi = {
  pipeline: () =>
    request<{ success: boolean; data: PipelineData }>("GET", "/api/insights/pipeline"),
  siteRanking: () =>
    request<{ success: boolean; data: SiteRankingEntry[] }>("GET", "/api/insights/site-ranking"),
  roiDistribution: () =>
    request<{ success: boolean; data: RoiDistributionEntry[] }>("GET", "/api/insights/roi-distribution"),
}
