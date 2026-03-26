"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Settings as SettingsIcon, Users, MapPin, Bell, Lock, ScrollText, ClipboardList } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import {
  settingsApi,
  userRequestsApi,
  auditApi,
  type TeamMember,
  type UserRequestRow,
  type InfrastructureConfig,
  type UserPermissionsMap,
  type AuditLogRow,
} from "@/lib/api"
import {
  hasPermission,
  canReadModule,
  normalizeRole,
  getDefaultPermissions,
  mergeMemberPermissions,
  normalizePermissionsForSubmit,
  PERMISSION_MODULES,
  type PermissionModule,
} from "@/lib/permissions"
import { useAuth } from "@/app/context/auth-context"

const MODULE_LABELS: Record<PermissionModule, string> = {
  farms: "Farms",
  sites: "Sites",
  evaluations: "Evaluations",
  proposals: "Proposals",
  reports: "Reports",
  finance: "Finance",
  settings: "Settings",
}

const MAPBOX_KEY = "mapbox_key"
const MAP_CENTER_LAT = "map_center_lat"
const MAP_CENTER_LNG = "map_center_lng"
const MAP_ZOOM = "map_zoom"
const ALERT_SETTINGS = "alert_settings"

type InfraKey = keyof InfrastructureConfig

export default function SettingsPage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState("team")
  const [team, setTeam] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [addName, setAddName] = useState("")
  const [addEmail, setAddEmail] = useState("")
  const [addRole, setAddRole] = useState<"admin" | "editor" | "viewer">("viewer")
  const [addSubmitting, setAddSubmitting] = useState(false)
  const [editMember, setEditMember] = useState<TeamMember | null>(null)
  const [editRole, setEditRole] = useState<"admin" | "editor" | "viewer">("viewer")
  const [editStatus, setEditStatus] = useState<"active" | "inactive">("active")
  const [editPermissions, setEditPermissions] = useState<UserPermissionsMap>(() =>
    getDefaultPermissions("viewer")
  )
  const [editSaving, setEditSaving] = useState(false)
  const [removeId, setRemoveId] = useState<string | null>(null)
  const [removeSubmitting, setRemoveSubmitting] = useState(false)
  const [notifications, setNotifications] = useState({
    proposalSubmitted: true,
    boundaryDrawn: true,
    costEstimateGenerated: true,
    approvalRequired: true,
  })
  const [mapConfig, setMapConfig] = useState({
    mapboxKey: "",
    centerLat: "",
    centerLng: "",
    zoom: "10",
  })
  const [infraConfig, setInfraConfig] = useState<InfrastructureConfig | null>(null)
  const [infraLoading, setInfraLoading] = useState(true)
  const [infraSaving, setInfraSaving] = useState(false)
  const [alertSettings, setAlertSettings] = useState({
    emailOnNewSiteEvaluation: true,
    emailOnProposalApproval: true,
    weeklySummaryReport: false,
  })
  const [auditLogs, setAuditLogs] = useState<AuditLogRow[]>([])
  const [auditLoading, setAuditLoading] = useState(false)
  const [userRequests, setUserRequests] = useState<UserRequestRow[]>([])
  const [userRequestsLoading, setUserRequestsLoading] = useState(false)
  const [approveFor, setApproveFor] = useState<UserRequestRow | null>(null)
  const [approveRole, setApproveRole] = useState<"admin" | "editor" | "viewer">("viewer")
  const [approvePermissions, setApprovePermissions] = useState<UserPermissionsMap>(() =>
    getDefaultPermissions("viewer")
  )
  const [approveSaving, setApproveSaving] = useState(false)
  const [rejectReqId, setRejectReqId] = useState<string | null>(null)
  const [rejectSubmitting, setRejectSubmitting] = useState(false)

  const canViewAudit = canReadModule(user, "settings")
  const showUserRequests = normalizeRole(user?.role) === "admin"
  const settingsTabCount = 4 + (showUserRequests ? 1 : 0) + (canViewAudit ? 1 : 0)

  const loadTeam = () => {
    setLoading(true)
    settingsApi
      .listTeam()
      .then((res) => {
        if (res?.data) setTeam(Array.isArray(res.data) ? res.data : [])
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load team"))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadTeam()
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    setMapConfig({
      mapboxKey: localStorage.getItem(MAPBOX_KEY) ?? "",
      centerLat: localStorage.getItem(MAP_CENTER_LAT) ?? "12.97",
      centerLng: localStorage.getItem(MAP_CENTER_LNG) ?? "77.59",
      zoom: localStorage.getItem(MAP_ZOOM) ?? "10",
    })
    const alertRaw = localStorage.getItem(ALERT_SETTINGS)
    if (alertRaw) {
      try {
        const a = JSON.parse(alertRaw) as { emailOnNewSiteEvaluation?: boolean; emailOnProposalApproval?: boolean; weeklySummaryReport?: boolean }
        setAlertSettings((prev) => ({
          ...prev,
          ...a,
        }))
      } catch {
        // ignore
      }
    }
  }, [])

  useEffect(() => {
    setInfraLoading(true)
    settingsApi
      .getInfrastructure()
      .then((res) => {
        if (res?.data) setInfraConfig(res.data)
      })
      .catch(() => {})
      .finally(() => setInfraLoading(false))
  }, [])

  useEffect(() => {
    if (!canViewAudit || activeTab !== "audit") return
    setAuditLoading(true)
    auditApi
      .listLogs({ limit: "150" })
      .then((res) => {
        if (res?.data && Array.isArray(res.data)) setAuditLogs(res.data)
        else setAuditLogs([])
      })
      .catch(() => setAuditLogs([]))
      .finally(() => setAuditLoading(false))
  }, [canViewAudit, activeTab])

  const loadUserRequests = () => {
    if (!showUserRequests) return
    setUserRequestsLoading(true)
    userRequestsApi
      .listPending()
      .then((res) => {
        if (res?.data && Array.isArray(res.data)) setUserRequests(res.data)
        else setUserRequests([])
      })
      .catch(() => setUserRequests([]))
      .finally(() => setUserRequestsLoading(false))
  }

  useEffect(() => {
    if (!showUserRequests) return
    loadUserRequests()
  }, [showUserRequests])

  useEffect(() => {
    if (!showUserRequests || activeTab !== "user-requests") return
    loadUserRequests()
  }, [showUserRequests, activeTab])

  const handleAdd = async () => {
    if (!addName.trim() || !addEmail.trim()) return
    setAddSubmitting(true)
    setError(null)
    try {
      await settingsApi.addTeamMember({ name: addName.trim(), email: addEmail.trim(), role: addRole })
      setAddOpen(false)
      setAddName("")
      setAddEmail("")
      setAddRole("viewer")
      loadTeam()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add")
    } finally {
      setAddSubmitting(false)
    }
  }

  const openEditMember = (member: TeamMember) => {
    setEditMember(member)
    setEditRole(normalizeRole(member.role) as "admin" | "editor" | "viewer")
    setEditStatus((member.status === "active" ? "active" : "inactive") as "active" | "inactive")
    setEditPermissions(mergeMemberPermissions(member))
  }

  const closeEditMember = () => {
    setEditMember(null)
    setEditSaving(false)
  }

  const handleResetPermissionsToRoleDefault = () => {
    setEditPermissions(getDefaultPermissions(editRole))
  }

  const setModuleRead = (m: PermissionModule, checked: boolean) => {
    setEditPermissions((prev) => ({
      ...prev,
      [m]: { read: checked, write: checked ? prev[m].write : false },
    }))
  }

  const setModuleWrite = (m: PermissionModule, checked: boolean) => {
    setEditPermissions((prev) => ({
      ...prev,
      [m]: { read: checked ? true : prev[m].read, write: checked },
    }))
  }

  const handleSaveEdit = async () => {
    if (!editMember) return
    setError(null)
    setEditSaving(true)
    try {
      const isSelf = user != null && String(user.id) === String(editMember._id)
      const isTargetAdmin = normalizeRole(editRole) === "admin"
      if (isSelf) {
        await settingsApi.updateTeamMember(editMember._id, { role: editRole, status: editStatus })
      } else {
        const perms = isTargetAdmin
          ? getDefaultPermissions("admin")
          : normalizePermissionsForSubmit(editPermissions)
        await settingsApi.updateTeamMember(editMember._id, {
          role: editRole,
          status: editStatus,
          permissions: perms,
        })
      }
      closeEditMember()
      loadTeam()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update")
    } finally {
      setEditSaving(false)
    }
  }

  const handleRemoveConfirm = async () => {
    if (!removeId) return
    setRemoveSubmitting(true)
    setError(null)
    try {
      await settingsApi.removeTeamMember(removeId)
      setRemoveId(null)
      loadTeam()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove")
    } finally {
      setRemoveSubmitting(false)
    }
  }

  const openApproveRequest = (row: UserRequestRow) => {
    setApproveFor(row)
    const r = normalizeRole(row.requestedRole ?? "") as "admin" | "editor" | "viewer"
    const role =
      r === "admin" || r === "editor" || r === "viewer" ? r : "viewer"
    setApproveRole(role)
    setApprovePermissions(getDefaultPermissions(role))
  }

  const closeApproveRequest = () => {
    setApproveFor(null)
    setApproveSaving(false)
  }

  const handleApproveSave = async () => {
    if (!approveFor) return
    setApproveSaving(true)
    setError(null)
    try {
      const isTargetAdmin = normalizeRole(approveRole) === "admin"
      const perms = isTargetAdmin
        ? getDefaultPermissions("admin")
        : normalizePermissionsForSubmit(approvePermissions)
      await userRequestsApi.approve(approveFor._id, { role: approveRole, permissions: perms })
      closeApproveRequest()
      loadUserRequests()
      loadTeam()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve")
    } finally {
      setApproveSaving(false)
    }
  }

  const handleRejectConfirm = async () => {
    if (!rejectReqId) return
    setRejectSubmitting(true)
    setError(null)
    try {
      await userRequestsApi.reject(rejectReqId)
      setRejectReqId(null)
      loadUserRequests()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reject")
    } finally {
      setRejectSubmitting(false)
    }
  }

  const setApproveModuleRead = (m: PermissionModule, checked: boolean) => {
    setApprovePermissions((prev) => ({
      ...prev,
      [m]: { read: checked, write: checked ? prev[m].write : false },
    }))
  }

  const setApproveModuleWrite = (m: PermissionModule, checked: boolean) => {
    setApprovePermissions((prev) => ({
      ...prev,
      [m]: { read: checked ? true : prev[m].read, write: checked },
    }))
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <SettingsIcon className="h-8 w-8 text-[#387F43]" />
          Settings
        </h1>
        <p className="text-muted-foreground">Configure Forge sales and evaluation tools</p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList
          className={`grid w-full lg:w-max ${
            settingsTabCount === 4
              ? "grid-cols-4"
              : settingsTabCount === 5
                ? "grid-cols-5"
                : "grid-cols-6"
          }`}
        >
          <TabsTrigger value="team" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Team</span>
          </TabsTrigger>
          <TabsTrigger value="map" className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            <span className="hidden sm:inline">Map Config</span>
          </TabsTrigger>
          <TabsTrigger value="infrastructure" className="flex items-center gap-2">
            <Lock className="h-4 w-4" />
            <span className="hidden sm:inline">Infrastructure</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Alerts</span>
          </TabsTrigger>
          {showUserRequests && (
            <TabsTrigger value="user-requests" className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              <span className="hidden sm:inline">User Requests</span>
            </TabsTrigger>
          )}
          {canViewAudit && (
            <TabsTrigger value="audit" className="flex items-center gap-2">
              <ScrollText className="h-4 w-4" />
              <span className="hidden sm:inline">Audit Logs</span>
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="team" className="space-y-4">
          {hasPermission(user, "canManageTeam") ? (
            <>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Sales Team Management</CardTitle>
                      <CardDescription>Manage team members and their access</CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2 justify-end items-start">
                      {normalizeRole(user?.role) === "admin" ? (
                        <div className="flex flex-col items-end gap-1">
                          <Button
                            variant="outline"
                            onClick={() => setActiveTab("user-requests")}
                          >
                            {userRequests.length > 0
                              ? `Approve Requests (${userRequests.length})`
                              : "Approve Requests"}
                          </Button>
                          <p className="text-xs text-muted-foreground text-right max-w-[240px] leading-snug">
                            Review and approve new user registrations
                          </p>
                        </div>
                      ) : null}
                      <Button
                        className="bg-[#387F43] hover:bg-[#2d6535]"
                        onClick={() => setAddOpen(true)}
                      >
                        + Add Team Member
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <p className="text-sm text-muted-foreground">Loading…</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {team.map((member) => (
                          <TableRow key={member._id}>
                            <TableCell className="font-medium">{member.name}</TableCell>
                            <TableCell>{member.email}</TableCell>
                            <TableCell>{member.role}</TableCell>
                            <TableCell>
                              <span
                                className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                                  member.status === "active"
                                    ? "bg-green-100 text-green-800"
                                    : "bg-gray-100 text-gray-800"
                                }`}
                              >
                                {member.status}
                              </span>
                            </TableCell>
                            <TableCell className="text-right space-x-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openEditMember(member)}
                              >
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600 bg-transparent hover:bg-red-50"
                                onClick={() => setRemoveId(member._id)}
                              >
                                Remove
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Role Permissions</CardTitle>
                  <CardDescription>Configure access levels for different roles</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">Sales Director</p>
                      <p className="text-sm text-muted-foreground">Full access to all features</p>
                    </div>
                    <span className="text-xs font-semibold bg-green-100 text-green-800 px-3 py-1 rounded-full">
                      Admin
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">Field Evaluator</p>
                      <p className="text-sm text-muted-foreground">
                        Draw boundaries, create site evaluations
                      </p>
                    </div>
                    <span className="text-xs font-semibold bg-blue-100 text-blue-800 px-3 py-1 rounded-full">
                      Editor
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">Sales Associate</p>
                      <p className="text-sm text-muted-foreground">View and download reports</p>
                    </div>
                    <span className="text-xs font-semibold bg-gray-100 text-gray-800 px-3 py-1 rounded-full">
                      Viewer
                    </span>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Team Management</CardTitle>
                <CardDescription>
                  You don't have permission to manage team members. Please contact your
                  administrator.
                </CardDescription>
              </CardHeader>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="map" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Map Config</CardTitle>
              <CardDescription>Map API key and default map center (saved in browser only)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="mapbox_key">Mapbox API Key</Label>
                <Input
                  id="mapbox_key"
                  type="password"
                  placeholder="Enter Mapbox API key"
                  value={mapConfig.mapboxKey}
                  onChange={(e) => setMapConfig((c) => ({ ...c, mapboxKey: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="map_center_lat">Default center latitude</Label>
                  <Input
                    id="map_center_lat"
                    type="number"
                    step="any"
                    placeholder="e.g. 12.97"
                    value={mapConfig.centerLat}
                    onChange={(e) => setMapConfig((c) => ({ ...c, centerLat: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="map_center_lng">Default center longitude</Label>
                  <Input
                    id="map_center_lng"
                    type="number"
                    step="any"
                    placeholder="e.g. 77.59"
                    value={mapConfig.centerLng}
                    onChange={(e) => setMapConfig((c) => ({ ...c, centerLng: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="map_zoom">Default zoom level (1–20)</Label>
                <Input
                  id="map_zoom"
                  type="number"
                  min={1}
                  max={20}
                  value={mapConfig.zoom}
                  onChange={(e) => setMapConfig((c) => ({ ...c, zoom: e.target.value }))}
                />
              </div>
              <Button
                className="bg-[#387F43] hover:bg-[#2d6535]"
                onClick={() => {
                  if (typeof window === "undefined") return
                  localStorage.setItem(MAPBOX_KEY, mapConfig.mapboxKey)
                  localStorage.setItem(MAP_CENTER_LAT, mapConfig.centerLat)
                  localStorage.setItem(MAP_CENTER_LNG, mapConfig.centerLng)
                  localStorage.setItem(MAP_ZOOM, mapConfig.zoom)
                }}
              >
                Save
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="infrastructure" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Cost per Acre & ROI</CardTitle>
              <CardDescription>Values used by the recommendation engine</CardDescription>
            </CardHeader>
            <CardContent>
              {infraLoading ? (
                <p className="text-sm text-muted-foreground animate-pulse">Loading...</p>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Min (₹/acre)</TableHead>
                        <TableHead>Max (₹/acre)</TableHead>
                        <TableHead>ROI (months)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(["polyhouse", "shade_net", "open_field"] as InfraKey[]).map((key) => (
                        <TableRow key={key}>
                          <TableCell className="font-medium capitalize">{key.replace("_", " ")}</TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={0}
                              className="w-32"
                              value={infraConfig?.[key]?.minCost ?? 0}
                              onChange={(e) =>
                                setInfraConfig((c) => {
                                  if (!c) return c
                                  return {
                                    ...c,
                                    [key]: { ...c[key], minCost: Number(e.target.value) || 0 },
                                  }
                                })
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={0}
                              className="w-32"
                              value={infraConfig?.[key]?.maxCost ?? 0}
                              onChange={(e) =>
                                setInfraConfig((c) => {
                                  if (!c) return c
                                  return {
                                    ...c,
                                    [key]: { ...c[key], maxCost: Number(e.target.value) || 0 },
                                  }
                                })
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={0}
                              className="w-20"
                              value={infraConfig?.[key]?.roiMonths ?? 0}
                              onChange={(e) =>
                                setInfraConfig((c) => {
                                  if (!c) return c
                                  return {
                                    ...c,
                                    [key]: { ...c[key], roiMonths: Number(e.target.value) || 0 },
                                  }
                                })
                              }
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <Button
                    className="mt-4 bg-[#387F43] hover:bg-[#2d6535]"
                    disabled={infraSaving || !infraConfig}
                    onClick={async () => {
                      if (!infraConfig) return
                      setInfraSaving(true)
                      try {
                        const res = await settingsApi.saveInfrastructure(infraConfig)
                        if (res?.data) setInfraConfig(res.data)
                      } finally {
                        setInfraSaving(false)
                      }
                    }}
                  >
                    {infraSaving ? "Saving…" : "Save"}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Alerts</CardTitle>
              <CardDescription>Saved in browser only (localStorage)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Email notifications on new site evaluation</p>
                  <p className="text-sm text-muted-foreground">Get notified when a new site evaluation is created</p>
                </div>
                <Switch
                  checked={alertSettings.emailOnNewSiteEvaluation}
                  onCheckedChange={(checked) => {
                    const next = { ...alertSettings, emailOnNewSiteEvaluation: checked }
                    setAlertSettings(next)
                    if (typeof window !== "undefined") localStorage.setItem(ALERT_SETTINGS, JSON.stringify(next))
                  }}
                />
              </div>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Email notifications on proposal approval</p>
                  <p className="text-sm text-muted-foreground">Get notified when a proposal is approved</p>
                </div>
                <Switch
                  checked={alertSettings.emailOnProposalApproval}
                  onCheckedChange={(checked) => {
                    const next = { ...alertSettings, emailOnProposalApproval: checked }
                    setAlertSettings(next)
                    if (typeof window !== "undefined") localStorage.setItem(ALERT_SETTINGS, JSON.stringify(next))
                  }}
                />
              </div>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Weekly summary report</p>
                  <p className="text-sm text-muted-foreground">Receive a weekly summary by email</p>
                </div>
                <Switch
                  checked={alertSettings.weeklySummaryReport}
                  onCheckedChange={(checked) => {
                    const next = { ...alertSettings, weeklySummaryReport: checked }
                    setAlertSettings(next)
                    if (typeof window !== "undefined") localStorage.setItem(ALERT_SETTINGS, JSON.stringify(next))
                  }}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {showUserRequests && (
          <TabsContent value="user-requests" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>User Requests</CardTitle>
                <CardDescription>Pending registration requests — approve to create an account or reject</CardDescription>
              </CardHeader>
              <CardContent>
                {userRequestsLoading ? (
                  <p className="text-sm text-muted-foreground">Loading…</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Requested Role</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {userRequests.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-muted-foreground text-sm">
                            No pending user requests
                          </TableCell>
                        </TableRow>
                      ) : (
                        userRequests.map((row) => (
                          <TableRow key={row._id}>
                            <TableCell className="font-medium">{row.name}</TableCell>
                            <TableCell>{row.email}</TableCell>
                            <TableCell>{row.requestedRole ?? "—"}</TableCell>
                            <TableCell className="text-right space-x-2">
                              <Button size="sm" variant="outline" onClick={() => openApproveRequest(row)}>
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600 bg-transparent hover:bg-red-50"
                                onClick={() => setRejectReqId(row._id)}
                              >
                                Reject
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {canViewAudit && (
          <TabsContent value="audit" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Audit Logs</CardTitle>
                <CardDescription>Recent security and data changes (newest first)</CardDescription>
              </CardHeader>
              <CardContent>
                {auditLoading ? (
                  <p className="text-sm text-muted-foreground">Loading…</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Module</TableHead>
                        <TableHead>Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditLogs.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-muted-foreground text-sm">
                            No audit entries yet.
                          </TableCell>
                        </TableRow>
                      ) : (
                        auditLogs.map((row) => (
                          <TableRow key={String(row._id)}>
                            <TableCell className="text-sm">
                              {row.userName || row.userEmail || String(row.userId)}
                            </TableCell>
                            <TableCell className="text-sm font-medium">{row.action}</TableCell>
                            <TableCell className="text-sm">{row.module}</TableCell>
                            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                              {row.createdAt
                                ? new Date(row.createdAt).toLocaleString()
                                : "—"}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      <Dialog
        open={!!editMember}
        onOpenChange={(open) => {
          if (!open) closeEditMember()
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit team member</DialogTitle>
          </DialogHeader>
          {editMember && (
            <>
              <div className="space-y-4 py-2">
                <div className="space-y-1 text-sm">
                  <p>
                    <span className="text-muted-foreground">Name</span>{" "}
                    <span className="font-medium">{editMember.name}</span>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Email</span>{" "}
                    <span className="font-medium">{editMember.email}</span>
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editRole">Role</Label>
                  <select
                    id="editRole"
                    value={editRole}
                    onChange={(e) => {
                      const r = e.target.value as "admin" | "editor" | "viewer"
                      const prev = editRole
                      setEditRole(r)
                      if (r === "admin") {
                        setEditPermissions(getDefaultPermissions("admin"))
                      } else if (prev === "admin") {
                        setEditPermissions(getDefaultPermissions(r))
                      }
                    }}
                    className="w-full border rounded px-3 py-2 text-sm"
                  >
                    <option value="viewer">viewer</option>
                    <option value="editor">editor</option>
                    <option value="admin">admin</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editStatus">Status</Label>
                  <select
                    id="editStatus"
                    value={editStatus}
                    onChange={(e) =>
                      setEditStatus(e.target.value as "active" | "inactive")
                    }
                    className="w-full border rounded px-3 py-2 text-sm"
                  >
                    <option value="active">active</option>
                    <option value="inactive">inactive</option>
                  </select>
                </div>

                {(() => {
                  const isEditSelf = user != null && String(user.id) === String(editMember._id)
                  const isEditingAdminRole = normalizeRole(editRole) === "admin"
                  const permissionsDisabled = isEditSelf
                  const settingsWriteLocked = isEditingAdminRole && !isEditSelf

                  return (
                    <div className="space-y-3 border rounded-lg p-4">
                      <div>
                        <p className="text-sm font-medium">Permissions</p>
                        <p className="text-xs text-muted-foreground">
                          Module access — Read / Write
                        </p>
                      </div>
                      {isEditSelf && (
                        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                          You cannot change your own permissions.
                        </p>
                      )}
                      {isEditingAdminRole && !isEditSelf && (
                        <p className="text-xs text-muted-foreground">
                          Administrators always have full access on save. The Settings Write option
                          cannot be turned off for this role.
                        </p>
                      )}
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Module</TableHead>
                            <TableHead className="text-center w-[100px]">Read</TableHead>
                            <TableHead className="text-center w-[100px]">Write</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {PERMISSION_MODULES.map((m) => {
                            const row = editPermissions[m]
                            const writeLocked =
                              permissionsDisabled ||
                              !row.read ||
                              (settingsWriteLocked && m === "settings")
                            return (
                              <TableRow key={m}>
                                <TableCell className="font-medium">{MODULE_LABELS[m]}</TableCell>
                                <TableCell className="text-center">
                                  <Checkbox
                                    checked={row.read}
                                    disabled={permissionsDisabled}
                                    onCheckedChange={(c) => setModuleRead(m, c === true)}
                                    aria-label={`${MODULE_LABELS[m]} read`}
                                  />
                                </TableCell>
                                <TableCell className="text-center">
                                  <Checkbox
                                    checked={row.write}
                                    disabled={writeLocked}
                                    onCheckedChange={(c) => setModuleWrite(m, c === true)}
                                    aria-label={`${MODULE_LABELS[m]} write`}
                                  />
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full sm:w-auto"
                        disabled={permissionsDisabled}
                        onClick={handleResetPermissionsToRoleDefault}
                      >
                        Reset to Role Default
                      </Button>
                    </div>
                  )
                })()}
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button type="button" variant="outline" onClick={closeEditMember}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="bg-[#387F43] hover:bg-[#2d6535]"
                  disabled={editSaving}
                  onClick={handleSaveEdit}
                >
                  {editSaving ? "Saving…" : "Save"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Team Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="addName">Name</Label>
              <Input
                id="addName"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                placeholder="Full name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="addEmail">Email</Label>
              <Input
                id="addEmail"
                type="email"
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                placeholder="email@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="addRole">Role</Label>
              <select
                id="addRole"
                value={addRole}
                onChange={(e) => setAddRole(e.target.value as "admin" | "editor" | "viewer")}
                className="w-full border rounded px-3 py-2"
              >
                <option value="viewer">Sales Associate (viewer)</option>
                <option value="editor">Field Evaluator (editor)</option>
                <option value="admin">admin</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-[#387F43] hover:bg-[#2d6535]"
              onClick={handleAdd}
              disabled={addSubmitting || !addName.trim() || !addEmail.trim()}
            >
              {addSubmitting ? "Adding…" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!approveFor}
        onOpenChange={(open) => {
          if (!open) closeApproveRequest()
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Approve registration</DialogTitle>
          </DialogHeader>
          {approveFor && (
            <>
              <div className="space-y-4 py-2">
                <div className="space-y-1 text-sm">
                  <p>
                    <span className="text-muted-foreground">Name</span>{" "}
                    <span className="font-medium">{approveFor.name}</span>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Email</span>{" "}
                    <span className="font-medium">{approveFor.email}</span>
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="approveRole">Role</Label>
                  <select
                    id="approveRole"
                    value={approveRole}
                    onChange={(e) => {
                      const r = e.target.value as "admin" | "editor" | "viewer"
                      setApproveRole(r)
                      setApprovePermissions(getDefaultPermissions(r))
                    }}
                    className="w-full border rounded px-3 py-2"
                  >
                    <option value="viewer">Sales Associate (viewer)</option>
                    <option value="editor">Field Evaluator (editor)</option>
                    <option value="admin">admin</option>
                  </select>
                </div>
                {(() => {
                  const permissionsDisabled = normalizeRole(approveRole) === "admin"
                  return (
                    <div className="space-y-2">
                      <Label>Permissions (optional override)</Label>
                      <p className="text-xs text-muted-foreground">
                        Admin role always has full access. For other roles, adjust module access or use defaults.
                      </p>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Module</TableHead>
                            <TableHead className="text-center">Read</TableHead>
                            <TableHead className="text-center">Write</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {PERMISSION_MODULES.map((m) => {
                            const row = approvePermissions[m]
                            const writeLocked = permissionsDisabled || !row.read
                            return (
                              <TableRow key={m}>
                                <TableCell className="font-medium">{MODULE_LABELS[m]}</TableCell>
                                <TableCell className="text-center">
                                  <Checkbox
                                    checked={row.read}
                                    disabled={permissionsDisabled}
                                    onCheckedChange={(c) => setApproveModuleRead(m, c === true)}
                                    aria-label={`${MODULE_LABELS[m]} read`}
                                  />
                                </TableCell>
                                <TableCell className="text-center">
                                  <Checkbox
                                    checked={row.write}
                                    disabled={writeLocked}
                                    onCheckedChange={(c) => setApproveModuleWrite(m, c === true)}
                                    aria-label={`${MODULE_LABELS[m]} write`}
                                  />
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full sm:w-auto"
                        disabled={permissionsDisabled}
                        onClick={() => setApprovePermissions(getDefaultPermissions(approveRole))}
                      >
                        Reset to Role Default
                      </Button>
                    </div>
                  )
                })()}
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button type="button" variant="outline" onClick={closeApproveRequest}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="bg-[#387F43] hover:bg-[#2d6535]"
                  disabled={approveSaving}
                  onClick={handleApproveSave}
                >
                  {approveSaving ? "Creating user…" : "Approve & create user"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!removeId} onOpenChange={(open) => !open && setRemoveId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove team member?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the user from the team. They will no longer have access.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveConfirm}
              className="bg-red-600 hover:bg-red-700"
              disabled={removeSubmitting}
            >
              {removeSubmitting ? "Removing…" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!rejectReqId} onOpenChange={(open) => !open && setRejectReqId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject registration request?</AlertDialogTitle>
            <AlertDialogDescription>
              This user will not be able to sign in until they submit a new request.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRejectConfirm}
              className="bg-red-600 hover:bg-red-700"
              disabled={rejectSubmitting}
            >
              {rejectSubmitting ? "Rejecting…" : "Reject"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
