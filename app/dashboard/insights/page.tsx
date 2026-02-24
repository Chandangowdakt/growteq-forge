'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { TrendingUp, MapPin, Target, AlertCircle } from 'lucide-react'

const siteEvaluationTrends = [
  { month: 'Jan', drafted: 4, submitted: 2, approved: 1 },
  { month: 'Feb', drafted: 6, submitted: 3, approved: 2 },
  { month: 'Mar', drafted: 8, submitted: 5, approved: 3 },
  { month: 'Apr', drafted: 10, submitted: 7, approved: 5 },
  { month: 'May', drafted: 12, submitted: 9, approved: 6 },
]

const roiProjection = [
  { month: 'Month 1', polyhouse: 0, shadeNet: 5, openField: 8 },
  { month: 'Month 3', polyhouse: 8, shadeNet: 12, openField: 15 },
  { month: 'Month 6', polyhouse: 18, shadeNet: 22, openField: 28 },
  { month: 'Month 12', polyhouse: 35, shadeNet: 40, openField: 50 },
]

const siteRanking = [
  { site: 'Hosahalli Farm', score: 92, recommendation: 'Polyhouse', roi: '18 months' },
  { site: 'Kodigenahalli', score: 88, recommendation: 'Polyhouse', roi: '20 months' },
  { site: 'Mudugere Farm', score: 82, recommendation: 'Shade Net', roi: '6 months' },
  { site: 'Chikka Soluru', score: 75, recommendation: 'Open Field', roi: '3 months' },
]

export default function InsightsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Insights</h1>
        <p className="text-muted-foreground">Market analysis and predictive insights for site evaluation strategy</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-[#387F43]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <MapPin className="h-4 w-4 text-[#387F43]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">50%</div>
            <p className="text-xs text-green-600 flex items-center gap-1 mt-1">
              <TrendingUp className="h-3 w-3" />
              +8% from last month
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Avg Site Quality</CardTitle>
            <Target className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">85/100</div>
            <p className="text-xs text-muted-foreground mt-1">Across all evaluations</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-600">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Avg ROI Potential</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">115%</div>
            <p className="text-xs text-muted-foreground mt-1">Across proposals</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pipeline Value</CardTitle>
            <AlertCircle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹5.93 Cr</div>
            <p className="text-xs text-muted-foreground mt-1">Pending investment</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Site Evaluation Pipeline</CardTitle>
            <CardDescription>Monthly progress through sales funnel</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={siteEvaluationTrends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="drafted" fill="#fb923c" name="Drafted" />
                <Bar dataKey="submitted" fill="#3b82f6" name="Submitted" />
                <Bar dataKey="approved" fill="#22c55e" name="Approved" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>ROI Projection by Infrastructure</CardTitle>
            <CardDescription>Expected returns over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={roiProjection}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value: number) => `₹${value}L`} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="polyhouse"
                  stroke="#387F43"
                  strokeWidth={2}
                  name="Polyhouse"
                />
                <Line
                  type="monotone"
                  dataKey="shadeNet"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  name="Shade Net"
                />
                <Line
                  type="monotone"
                  dataKey="openField"
                  stroke="#10b981"
                  strokeWidth={2}
                  name="Open Field"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-[#387F43]" />
            Site Suitability Ranking
          </CardTitle>
          <CardDescription>Overall site quality and recommended infrastructure</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {siteRanking.map((item, idx) => (
              <div key={idx} className="p-4 border rounded-lg hover:bg-gray-50">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold">{item.site}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Recommended: {item.recommendation} • ROI: {item.roi}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-[#387F43]">{item.score}</p>
                    <p className="text-xs text-muted-foreground">/ 100</p>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-[#387F43] h-2 rounded-full transition-all"
                    style={{ width: `${item.score}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Market Insights & Recommendations</CardTitle>
          <CardDescription>Strategic suggestions based on evaluation data</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="font-medium text-blue-900 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                High Demand Infrastructure
              </p>
              <p className="text-xs text-blue-700 mt-2">
                Polyhouse structures showing 92% site suitability. Focus sales efforts on high-yield vegetable
                farms.
              </p>
            </div>

            <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
              <p className="font-medium text-amber-900 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Growth Opportunity
              </p>
              <p className="text-xs text-amber-700 mt-2">
                50% of drafted evaluations converting to submissions. Optimize boundary mapping process for
                faster turnaround.
              </p>
            </div>

            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <p className="font-medium text-green-900 flex items-center gap-2">
                <Target className="h-4 w-4" />
                Premium Positioning
              </p>
              <p className="text-xs text-green-700 mt-2">
                Shade Net ROI exceeding projections by 20%. Recommend as cost-effective alternative for
                budget-conscious buyers.
              </p>
            </div>

            <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
              <p className="font-medium text-purple-900 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Seasonal Trends
              </p>
              <p className="text-xs text-purple-700 mt-2">
                Site evaluation interest peaks in pre-monsoon season. Plan inventory and staffing accordingly.
              </p>
            </div>

            <div className="p-4 bg-red-50 rounded-lg border border-red-200">
              <p className="font-medium text-red-900 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Risk Alert
              </p>
              <p className="text-xs text-red-700 mt-2">
                3 submitted proposals pending approval for 30+ days. Follow up to prevent deal loss.
              </p>
            </div>

            <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-200">
              <p className="font-medium text-indigo-900 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Target Expansion
              </p>
              <p className="text-xs text-indigo-700 mt-2">
                Open Field farms showing lower conversion but shorter ROI. Develop specific messaging for this
                segment.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
