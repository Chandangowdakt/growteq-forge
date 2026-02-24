'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FileText, Download, MapPin } from 'lucide-react'

const reportTypes = [
  {
    name: 'Site Evaluation Report',
    description: 'Complete site assessment with infrastructure recommendations',
    includes: ['Site survey details', 'Boundary map', 'Infrastructure options', 'Cost estimates', 'ROI analysis'],
    latest: '2025-02-22',
  },
  {
    name: 'Infrastructure Proposal',
    description: 'Detailed proposal with cost breakdown and timeline',
    includes: ['Technical specs', 'Investment details', 'ROI projection', 'Installation timeline', 'Maintenance plan'],
    latest: '2025-02-20',
  },
  {
    name: 'Cost Estimate Summary',
    description: 'Comprehensive cost analysis for all active sites',
    includes: ['Per-site costs', 'Total investment', 'Payment terms', 'Discount structure', 'Financing options'],
    latest: '2025-02-18',
  },
  {
    name: 'Sales Pipeline Report',
    description: 'Sales funnel and conversion tracking for submitted proposals',
    includes: ['Draft evaluations', 'Submitted proposals', 'Pending approvals', 'Conversion metrics', 'Revenue forecast'],
    latest: '2025-02-15',
  },
  {
    name: 'Site Comparison Matrix',
    description: 'Side-by-side analysis of multiple site evaluations',
    includes: ['Site metrics', 'Suitability scores', 'Cost comparison', 'ROI ranking', 'Recommendations'],
    latest: '2025-02-10',
  },
  {
    name: 'Executive Summary',
    description: 'High-level overview for stakeholders and management',
    includes: ['Key metrics', 'Growth potential', 'Market opportunity', 'Risk assessment', 'Next steps'],
    latest: '2025-02-08',
  },
]

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground">Generate and download reports for site evaluations and proposals</p>
        </div>
        <Button className="bg-[#387F43] hover:bg-[#2d6535]">+ Generate Report</Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {reportTypes.map((report, idx) => (
          <Card key={idx} className="flex flex-col">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5 text-[#387F43]" />
                {report.name}
              </CardTitle>
              <CardDescription>{report.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              <div className="mb-4 flex-1">
                <p className="text-xs font-semibold text-muted-foreground mb-2">Includes:</p>
                <ul className="text-xs text-muted-foreground space-y-1">
                  {report.includes.map((item, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <div className="w-1 h-1 bg-[#387F43] rounded-full" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Last generated: {report.latest}</p>
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1 bg-[#387F43] hover:bg-[#2d6535]" variant="default">
                    <Download className="h-3 w-3 mr-1" />
                    PDF
                  </Button>
                  <Button size="sm" className="flex-1 bg-transparent" variant="outline">
                    <Download className="h-3 w-3 mr-1" />
                    Excel
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-[#387F43]" />
            Quick Report Generator
          </CardTitle>
          <CardDescription>Customize and generate reports on demand</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Button variant="outline" className="h-auto py-6 flex flex-col items-start justify-start bg-transparent">
              <div className="text-sm font-medium mb-1">Single Site</div>
              <div className="text-xs text-muted-foreground">Generate for one site</div>
            </Button>
            <Button variant="outline" className="h-auto py-6 flex flex-col items-start justify-start bg-transparent">
              <div className="text-sm font-medium mb-1">Multiple Sites</div>
              <div className="text-xs text-muted-foreground">Compare all evaluations</div>
            </Button>
            <Button variant="outline" className="h-auto py-6 flex flex-col items-start justify-start bg-transparent">
              <div className="text-sm font-medium mb-1">Export Map</div>
              <div className="text-xs text-muted-foreground">Map with boundaries</div>
            </Button>
            <Button variant="outline" className="h-auto py-6 flex flex-col items-start justify-start bg-transparent">
              <div className="text-sm font-medium mb-1">Data Table</div>
              <div className="text-xs text-muted-foreground">Raw data in Excel</div>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
