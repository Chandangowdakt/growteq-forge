'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Switch } from '@/components/ui/switch'
import { Settings as SettingsIcon, Users, MapPin, Bell, Lock } from 'lucide-react'

const salesTeam = [
  { id: 1, name: 'Harish Kumar', email: 'harish@growteq.com', role: 'Sales Director', status: 'active' },
  { id: 2, name: 'Ramesh Singh', email: 'ramesh@growteq.com', role: 'Field Evaluator', status: 'active' },
  { id: 3, name: 'Priya Sharma', email: 'priya@growteq.com', role: 'Proposal Generator', status: 'active' },
  { id: 4, name: 'Rajesh Patel', email: 'rajesh@growteq.com', role: 'Sales Associate', status: 'inactive' },
]

const mapSettings = [
  { id: 1, provider: 'MapLibre GL JS', status: 'Active', coverage: 'Global' },
  { id: 2, provider: 'OpenStreetMap', status: 'Active', coverage: 'Global' },
]

const infrastructureTypes = [
  { id: 1, name: 'Polyhouse', status: 'Active', costRange: '₹25-35 lakhs/acre' },
  { id: 2, name: 'Shade Net', status: 'Active', costRange: '₹2-5 lakhs/acre' },
  { id: 3, name: 'Open Field', status: 'Active', costRange: '₹0.5-2 lakhs/acre' },
]

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('team')
  const [notifications, setNotifications] = useState({
    proposalSubmitted: true,
    boundaryDrawn: true,
    costEstimateGenerated: true,
    approvalRequired: true,
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <SettingsIcon className="h-8 w-8 text-[#387F43]" />
          Settings
        </h1>
        <p className="text-muted-foreground">Configure Forge sales and evaluation tools</p>
      </div>

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
                <Button className="bg-[#387F43] hover:bg-[#2d6535]">+ Add Team Member</Button>
              </div>
            </CardHeader>
            <CardContent>
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
                  {salesTeam.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{user.role}</TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                            user.status === 'active'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {user.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button size="sm" variant="outline">
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 bg-transparent hover:bg-red-50"
                        >
                          Remove
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
              <CardTitle>Map Provider Settings</CardTitle>
              <CardDescription>Configure mapping services for site evaluation</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Provider</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Coverage</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mapSettings.map((setting) => (
                    <TableRow key={setting.id}>
                      <TableCell className="font-medium">{setting.provider}</TableCell>
                      <TableCell>
                        <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          {setting.status}
                        </span>
                      </TableCell>
                      <TableCell>{setting.coverage}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline">
                          Configure
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Map Features</CardTitle>
              <CardDescription>Enable or disable specific mapping features</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Polygon Drawing</p>
                  <p className="text-sm text-muted-foreground">Draw land boundaries on map</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Area Calculation</p>
                  <p className="text-sm text-muted-foreground">Auto-calculate polygon area</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Satellite Imagery</p>
                  <p className="text-sm text-muted-foreground">Show satellite view option</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Boundary Export</p>
                  <p className="text-sm text-muted-foreground">Export boundaries as GeoJSON</p>
                </div>
                <Switch defaultChecked={false} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="infrastructure" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Infrastructure Types</CardTitle>
                  <CardDescription>Manage available infrastructure options for proposals</CardDescription>
                </div>
                <Button className="bg-[#387F43] hover:bg-[#2d6535]">+ Add Type</Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Infrastructure Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Cost Range</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {infrastructureTypes.map((infra) => (
                    <TableRow key={infra.id}>
                      <TableCell className="font-medium">{infra.name}</TableCell>
                      <TableCell>
                        <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          {infra.status}
                        </span>
                      </TableCell>
                      <TableCell>{infra.costRange}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button size="sm" variant="outline">
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 bg-transparent hover:bg-red-50"
                        >
                          Delete
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Cost Calculation</CardTitle>
              <CardDescription>Configure cost estimation parameters</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="baseRate">Base Rate per Acre</Label>
                <Input id="baseRate" placeholder="Enter base rate" defaultValue="₹ 10,00,000" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="laborCost">Labor Cost Adjustment (%)</Label>
                <Input id="laborCost" placeholder="Enter percentage" defaultValue="15" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contingency">Contingency Buffer (%)</Label>
                <Input id="contingency" placeholder="Enter percentage" defaultValue="10" />
              </div>
              <Button className="bg-[#387F43] hover:bg-[#2d6535]">Save Changes</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>Control alerts and notifications for the sales team</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Site Boundary Drawn</p>
                  <p className="text-sm text-muted-foreground">Notify when field evaluator completes boundary</p>
                </div>
                <Switch
                  checked={notifications.boundaryDrawn}
                  onCheckedChange={(checked) =>
                    setNotifications({ ...notifications, boundaryDrawn: checked })
                  }
                />
              </div>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Cost Estimate Generated</p>
                  <p className="text-sm text-muted-foreground">Alert when cost calculation is complete</p>
                </div>
                <Switch
                  checked={notifications.costEstimateGenerated}
                  onCheckedChange={(checked) =>
                    setNotifications({ ...notifications, costEstimateGenerated: checked })
                  }
                />
              </div>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Proposal Submitted</p>
                  <p className="text-sm text-muted-foreground">Notify when site evaluation is submitted</p>
                </div>
                <Switch
                  checked={notifications.proposalSubmitted}
                  onCheckedChange={(checked) =>
                    setNotifications({ ...notifications, proposalSubmitted: checked })
                  }
                />
              </div>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Approval Required</p>
                  <p className="text-sm text-muted-foreground">Alert when proposal awaits manager approval</p>
                </div>
                <Switch
                  checked={notifications.approvalRequired}
                  onCheckedChange={(checked) =>
                    setNotifications({ ...notifications, approvalRequired: checked })
                  }
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
