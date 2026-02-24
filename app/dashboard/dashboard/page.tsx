'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MapPin, Target, Zap, FileText } from 'lucide-react'

const currentSiteWork = [
  {
    id: 1,
    name: 'Hosahalli Farm',
    status: 'in-progress',
    lastBoundary: '2 hours ago',
    pointsMarked: 12,
    area: 7.2,
  },
  {
    id: 2,
    name: 'Mudugere Farm',
    status: 'submitted',
    lastBoundary: '1 day ago',
    pointsMarked: 8,
    area: 3.1,
  },
]

const pendingSubmissions = [
  {
    id: 1,
    site: 'Kodigenahalli',
    boundary: 'Ready for review',
    estimate: 'Generated',
    recommendation: 'Polyhouse',
  },
  {
    id: 2,
    site: 'Chikka Soluru',
    boundary: 'Needs refinement',
    estimate: 'Pending',
    recommendation: 'Open Field',
  },
]

const infrastructureRecommendations = [
  { type: 'Polyhouse', suitability: 'High', icon: '🏠', description: 'Controlled climate farming' },
  { type: 'Shade Net', suitability: 'Medium', icon: '🌐', description: 'Sun protection structure' },
  { type: 'Open Field', suitability: 'High', icon: '🌾', description: 'Traditional cultivation' },
]

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Work-in-progress: Current site evaluations and pending submissions</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Button className="h-auto py-4 px-6 bg-[#387F43] hover:bg-[#2d6535] flex flex-col items-start justify-start">
          <div className="text-xs font-medium opacity-90">Quick Start</div>
          <div className="text-base font-bold">+ Evaluate Site</div>
        </Button>
        <Button className="h-auto py-4 px-6 bg-blue-600 hover:bg-blue-700 flex flex-col items-start justify-start">
          <div className="text-xs font-medium opacity-90">Current Work</div>
          <div className="text-base font-bold">View Map</div>
        </Button>
        <Button className="h-auto py-4 px-6 bg-orange-600 hover:bg-orange-700 flex flex-col items-start justify-start">
          <div className="text-xs font-medium opacity-90">Pending</div>
          <div className="text-base font-bold">Estimate Cost</div>
        </Button>
        <Button className="h-auto py-4 px-6 bg-purple-600 hover:bg-purple-700 flex flex-col items-start justify-start">
          <div className="text-xs font-medium opacity-90">Export</div>
          <div className="text-base font-bold">Generate Proposal</div>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-[#387F43]" />
                Current Site Work
              </CardTitle>
              <CardDescription>Sites being evaluated now</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {currentSiteWork.map((site) => (
                <div key={site.id} className="p-4 border rounded-lg hover:bg-gray-50">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{site.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Marked: {site.lastBoundary} • {site.pointsMarked} points
                      </p>
                    </div>
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        site.status === 'in-progress'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-green-100 text-green-800'
                      }`}
                    >
                      {site.status === 'in-progress' ? 'In Progress' : 'Submitted'}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm mb-3">
                    <div className="p-2 bg-gray-50 rounded">
                      <p className="text-xs text-muted-foreground">Area</p>
                      <p className="font-bold text-[#387F43]">{site.area} acres</p>
                    </div>
                    <div className="p-2 bg-gray-50 rounded">
                      <p className="text-xs text-muted-foreground">Points</p>
                      <p className="font-bold">{site.pointsMarked}</p>
                    </div>
                    <div className="p-2 bg-gray-50 rounded">
                      <p className="text-xs text-muted-foreground">Status</p>
                      <p className="font-bold capitalize text-blue-600">
                        {site.status === 'in-progress' ? '60%' : '100%'}
                      </p>
                    </div>
                  </div>
                  <Button size="sm" className="w-full bg-[#387F43] hover:bg-[#2d6535]">
                    Continue Editing
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-orange-600" />
                Pending Submissions
              </CardTitle>
              <CardDescription>Sites awaiting infrastructure recommendation or cost estimate</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {pendingSubmissions.map((item) => (
                <div key={item.id} className="p-3 border rounded-lg">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-medium text-sm">{item.site}</p>
                      <div className="flex gap-2 mt-2 text-xs">
                        <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded">
                          Boundary: {item.boundary}
                        </span>
                        <span className="px-2 py-1 bg-orange-50 text-orange-700 rounded">
                          Cost: {item.estimate}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" className="w-full bg-transparent">
                    Generate Proposal
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-yellow-600" />
                Infrastructure Options
              </CardTitle>
              <CardDescription>Based on site evaluation</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {infrastructureRecommendations.map((item, idx) => (
                <div key={idx} className="p-3 border rounded-lg hover:bg-gray-50">
                  <p className="font-medium text-sm">{item.type}</p>
                  <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                      {item.suitability}
                    </span>
                    <span className="text-lg">{item.icon}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5 text-purple-600" />
                Next Step
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm font-medium text-blue-900 mb-2">Ready to generate proposal?</p>
                <p className="text-xs text-blue-700 mb-3">
                  Complete site evaluation and cost calculations for selected site.
                </p>
                <Button size="sm" className="w-full bg-[#387F43] hover:bg-[#2d6535]">
                  Generate Proposal
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
