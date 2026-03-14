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
import { Settings as SettingsIcon, Users, MapPin, Bell, Lock } from "lucide-react"
import { settingsApi, type TeamMember, type InfrastructureConfig } from "@/lib/api"

const MAPBOX_KEY = "mapbox_key"
const MAP_CENTER_LAT = "map_center_lat"
const MAP_CENTER_LNG = "map_center_lng"
const MAP_ZOOM = "map_zoom"
const ALERT_SETTINGS = "alert_settings"

const defaultInfra = {
  polyhouse: { minCostPerAcre: 2500000, maxCostPerAcre: 3500000, roiMonths: 18 },
  shade_net: { minCostPerAcre: 200000, maxCostPerAcre: 500000, roiMonths: 6 },
  open_field: { minCostPerAcre: 50000, maxCostPerAcre: 200000, roiMonths: 3 },
} as const
type InfraKey = keyof typeof defaultInfra

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("team")
  const [team, setTeam] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [addName, setAddName] = useState("")
  const [addEmail, setAddEmail] = useState("")
  const [addRole, setAddRole] = useState<"admin" | "user">("user")
  const [addSubmitting, setAddSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editRole, setEditRole] = useState<"admin" | "user">("user")
  const [editStatus, setEditStatus] = useState<"active" | "inactive">("active")
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
  const [infraConfig, setInfraConfig] = useState<InfrastructureConfig>(defaultInfra)
  const [infraLoading, setInfraLoading] = useState(false)
  const [infraSaving, setInfraSaving] = useState(false)
  const [alertSettings, setAlertSettings] = useState({
    emailOnNewSiteEvaluation: true,
    emailOnProposalApproval: true,
    weeklySummaryReport: false,
  })

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
    if (activeTab !== "infrastructure") return
    setInfraLoading(true)
    settingsApi
      .getInfrastructure()
      .then((res) => res?.data && setInfraConfig(res.data))
      .catch(() => {})
      .finally(() => setInfraLoading(false))
  }, [activeTab])

  const handleAdd = async () => {
    if (!addName.trim() || !addEmail.trim()) return
    setAddSubmitting(true)
    setError(null)
    try {
      await settingsApi.addTeamMember({ name: addName.trim(), email: addEmail.trim(), role: addRole })
      setAddOpen(false)
      setAddName("")
      setAddEmail("")
      setAddRole("user")
      loadTeam()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add")
    } finally {
      setAddSubmitting(false)
    }
  }

  const handleEdit = (member: TeamMember) => {
    setEditingId(member._id)
    setEditRole((member.role === "admin" ? "admin" : "user") as "admin" | "user")
    setEditStatus((member.status === "active" ? "active" : "inactive") as "active" | "inactive")
  }

  const handleSaveEdit = async () => {
    if (!editingId) return
    setError(null)
    try {
      await settingsApi.updateTeamMember(editingId, { role: editRole, status: editStatus })
      setEditingId(null)
      loadTeam()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update")
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
        <TabsList className="grid w-full grid-cols-4 lg:w-max">
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
        </TabsList>

        <TabsContent value="team" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Sales Team Management</CardTitle>
                  <CardDescription>Manage team members and their access</CardDescription>
                </div>
                <Button className="bg-[#387F43] hover:bg-[#2d6535]" onClick={() => setAddOpen(true)}>
                  + Add Team Member
                </Button>
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
                    {team.map((user) => (
                      <TableRow key={user._id}>
                        <TableCell className="font-medium">{user.name}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          {editingId === user._id ? (
                            <select
                              value={editRole}
                              onChange={(e) => setEditRole(e.target.value as "admin" | "user")}
                              className="border rounded px-2 py-1 text-sm"
                            >
                              <option value="user">user</option>
                              <option value="admin">admin</option>
                            </select>
                          ) : (
                            user.role
                          )}
                        </TableCell>
                        <TableCell>
                          {editingId === user._id ? (
                            <select
                              value={editStatus}
                              onChange={(e) => setEditStatus(e.target.value as "active" | "inactive")}
                              className="border rounded px-2 py-1 text-sm"
                            >
                              <option value="active">active</option>
                              <option value="inactive">inactive</option>
                            </select>
                          ) : (
                            <span
                              className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                                user.status === "active"
                                  ? "bg-green-100 text-green-800"
                                  : "bg-gray-100 text-gray-800"
                              }`}
                            >
                              {user.status}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          {editingId === user._id ? (
                            <>
                              <Button size="sm" onClick={handleSaveEdit}>
                                Save
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                                Cancel
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button size="sm" variant="outline" onClick={() => handleEdit(user)}>
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600 bg-transparent hover:bg-red-50"
                                onClick={() => setRemoveId(user._id)}
                              >
                                Remove
                              </Button>
                            </>
                          )}
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
                  <p className="text-sm text-muted-foreground">Draw boundaries, create site evaluations</p>
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
                              value={infraConfig[key]?.minCostPerAcre ?? 0}
                              onChange={(e) =>
                                setInfraConfig((c) => ({
                                  ...c,
                                  [key]: { ...c[key], minCostPerAcre: Number(e.target.value) || 0 },
                                }))
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={0}
                              className="w-32"
                              value={infraConfig[key]?.maxCostPerAcre ?? 0}
                              onChange={(e) =>
                                setInfraConfig((c) => ({
                                  ...c,
                                  [key]: { ...c[key], maxCostPerAcre: Number(e.target.value) || 0 },
                                }))
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={0}
                              className="w-20"
                              value={infraConfig[key]?.roiMonths ?? 0}
                              onChange={(e) =>
                                setInfraConfig((c) => ({
                                  ...c,
                                  [key]: { ...c[key], roiMonths: Number(e.target.value) || 0 },
                                }))
                              }
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <Button
                    className="mt-4 bg-[#387F43] hover:bg-[#2d6535]"
                    disabled={infraSaving}
                    onClick={async () => {
                      setInfraSaving(true)
                      try {
                        await settingsApi.saveInfrastructure(infraConfig)
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
      </Tabs>

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
                onChange={(e) => setAddRole(e.target.value as "admin" | "user")}
                className="w-full border rounded px-3 py-2"
              >
                <option value="user">user</option>
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
    </div>
  )
}
