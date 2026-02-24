'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { TrendingUp, DollarSign, Calculator } from 'lucide-react'

const costEstimates = [
  { month: 'Jan', polyhouse: 8500, shadeNet: 2100, openField: 850 },
  { month: 'Feb', polyhouse: 10200, shadeNet: 2800, openField: 1050 },
  { month: 'Mar', polyhouse: 12500, shadeNet: 3200, openField: 1200 },
  { month: 'Apr', polyhouse: 14200, shadeNet: 3800, openField: 1400 },
]

const infrastructureCosts = [
  {
    type: 'Polyhouse',
    costPerAcre: '₹25-35 lakhs',
    initialInvestment: '₹5.2 Cr',
    roi: '18 months',
    margins: '35-40%',
  },
  {
    type: 'Shade Net',
    costPerAcre: '₹2-5 lakhs',
    initialInvestment: '₹0.65 Cr',
    roi: '6 months',
    margins: '25-30%',
  },
  {
    type: 'Open Field',
    costPerAcre: '₹0.5-2 lakhs',
    initialInvestment: '₹0.18 Cr',
    roi: '3 months',
    margins: '15-20%',
  },
]

const proposals = [
  {
    id: 1,
    site: 'Hosahalli Farm',
    infrastructure: 'Polyhouse',
    area: 7.2,
    estimatedCost: '₹1.8 Cr',
    status: 'draft',
    expectedROI: '₹3.24 Cr',
  },
  {
    id: 2,
    site: 'Mudugere Farm',
    infrastructure: 'Shade Net',
    area: 3.1,
    estimatedCost: '₹0.45 Cr',
    status: 'submitted',
    expectedROI: '₹0.9 Cr',
  },
  {
    id: 3,
    site: 'Chikka Soluru',
    infrastructure: 'Open Field',
    area: 1.0,
    estimatedCost: '₹0.08 Cr',
    status: 'draft',
    expectedROI: '₹0.16 Cr',
  },
]

export default function FinancePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Finance</h1>
        <p className="text-muted-foreground">Cost estimates and ROI analysis for site infrastructure proposals</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-[#387F43]">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Total Estimated Investment</CardDescription>
            <CardTitle className="text-2xl text-[#387F43]">₹5.93 Cr</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Across all proposals</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-600">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Expected Total ROI</CardDescription>
            <CardTitle className="text-2xl text-green-600">₹12.8 Cr</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-xs">
              <TrendingUp className="h-3 w-3 text-green-600" />
              <span className="text-green-600">115% return potential</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Avg ROI Timeline</CardDescription>
            <CardTitle className="text-2xl text-blue-600">9 months</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Weighted average</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-600">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Active Proposals</CardDescription>
            <CardTitle className="text-2xl text-purple-600">{proposals.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {proposals.filter((p) => p.status === 'submitted').length} submitted
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="proposals">Proposals</TabsTrigger>
          <TabsTrigger value="comparison">Comparison</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-[#387F43]">Cost Trends by Infrastructure Type</CardTitle>
              <CardDescription>Estimated monthly proposal values</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={costEstimates}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value: number) => `₹${value} Lakhs`} />
                  <Legend />
                  <Line type="monotone" dataKey="polyhouse" stroke="#387F43" strokeWidth={2} name="Polyhouse" />
                  <Line type="monotone" dataKey="shadeNet" stroke="#f59e0b" strokeWidth={2} name="Shade Net" />
                  <Line type="monotone" dataKey="openField" stroke="#10b981" strokeWidth={2} name="Open Field" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5 text-[#387F43]" />
                Infrastructure Cost Comparison
              </CardTitle>
              <CardDescription>Per-acre investment and returns</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {infrastructureCosts.map((item, idx) => (
                  <div key={idx} className="p-4 border rounded-lg hover:bg-gray-50">
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="font-semibold">{item.type}</h3>
                      <span className="text-sm text-muted-foreground">{item.costPerAcre} per acre</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Initial Investment</p>
                        <p className="font-bold text-[#387F43]">{item.initialInvestment}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">ROI Timeline</p>
                        <p className="font-bold text-blue-600">{item.roi}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Profit Margins</p>
                        <p className="font-bold text-green-600">{item.margins}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="proposals" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Cost Estimates by Proposal</CardTitle>
              <CardDescription>Site evaluations with infrastructure recommendations</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Site</TableHead>
                    <TableHead>Infrastructure</TableHead>
                    <TableHead className="text-right">Area</TableHead>
                    <TableHead className="text-right">Est. Cost</TableHead>
                    <TableHead className="text-right">Expected ROI</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {proposals.map((proposal) => (
                    <TableRow key={proposal.id}>
                      <TableCell className="font-medium">{proposal.site}</TableCell>
                      <TableCell>{proposal.infrastructure}</TableCell>
                      <TableCell className="text-right">{proposal.area} acres</TableCell>
                      <TableCell className="text-right font-bold text-blue-600">{proposal.estimatedCost}</TableCell>
                      <TableCell className="text-right font-bold text-green-600">{proposal.expectedROI}</TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex px-2 py-1 rounded text-xs font-medium ${
                            proposal.status === 'submitted'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-orange-100 text-orange-800'
                          }`}
                        >
                          {proposal.status === 'submitted' ? 'Submitted' : 'Draft'}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="comparison" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-[#387F43]">Site Profitability Ranking</CardTitle>
              <CardDescription>Highest ROI potential</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {proposals
                  .sort((a, b) => {
                    const aROI = parseFloat(a.expectedROI.replace(/[₹\s,Cr]/g, ''))
                    const bROI = parseFloat(b.expectedROI.replace(/[₹\s,Cr]/g, ''))
                    return bROI - aROI
                  })
                  .map((proposal, rank) => (
                    <div key={proposal.id} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1">
                          <div className="w-8 h-8 rounded-full bg-[#387F43] text-white flex items-center justify-center font-bold text-sm">
                            {rank + 1}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium">{proposal.site}</p>
                            <p className="text-sm text-muted-foreground">{proposal.infrastructure}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-green-600">{proposal.expectedROI}</p>
                          <p className="text-xs text-muted-foreground">vs {proposal.estimatedCost} investment</p>
                        </div>
                      </div>
                      <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-green-600 h-2 rounded-full"
                          style={{
                            width: `${Math.min(
                              (parseFloat(proposal.expectedROI.replace(/[₹\s,Cr]/g, '')) /
                                parseFloat(proposal.estimatedCost.replace(/[₹\s,Cr]/g, ''))) *
                                10,
                              100
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
