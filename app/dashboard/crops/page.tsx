'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, AlertCircle } from 'lucide-react'

const infrastructureOptions = [
  {
    name: 'Polyhouse',
    icon: '🏠',
    suitability: 'High',
    description: 'Climate-controlled growing environment. Best for high-value crops.',
    costPerAcre: '₹25-35 lakhs',
    benefits: ['Climate control', 'Year-round farming', 'Higher yield', 'Pest protection'],
  },
  {
    name: 'Shade Net',
    icon: '🌐',
    suitability: 'Medium',
    description: 'Reduces solar radiation and wind damage. Ideal for sensitive crops.',
    costPerAcre: '₹2-5 lakhs',
    benefits: ['UV protection', 'Water retention', 'Lower cost', 'Easy installation'],
  },
  {
    name: 'Open Field',
    icon: '🌾',
    suitability: 'High',
    description: 'Traditional cultivation with minimal infrastructure investment.',
    costPerAcre: '₹0.5-2 lakhs',
    benefits: ['Low investment', 'Large-scale farming', 'Standard practices', 'Established market'],
  },
]

const cropCompatibility = [
  { crop: 'Tomato', polyhouse: true, shadeNet: true, openField: true },
  { crop: 'Cucumber', polyhouse: true, shadeNet: true, openField: false },
  { crop: 'Bell Pepper', polyhouse: true, shadeNet: false, openField: true },
  { crop: 'Lettuce', polyhouse: true, shadeNet: true, openField: false },
  { crop: 'Wheat', polyhouse: false, shadeNet: false, openField: true },
]

export default function CropsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Crops</h1>
        <p className="text-muted-foreground">Infrastructure recommendations based on site evaluation</p>
      </div>

      <div className="space-y-6">
        {infrastructureOptions.map((option, idx) => (
          <Card key={idx}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="text-4xl">{option.icon}</div>
                  <div className="flex-1">
                    <CardTitle className="text-2xl">{option.name}</CardTitle>
                    <CardDescription className="mt-2">{option.description}</CardDescription>
                  </div>
                </div>
                <Badge className={`${option.suitability === 'High' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                  {option.suitability} Suitability
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    Key Benefits
                  </h3>
                  <ul className="space-y-2">
                    {option.benefits.map((benefit, bidx) => (
                      <li key={bidx} className="text-sm text-muted-foreground flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-[#387F43] rounded-full" />
                        {benefit}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold text-sm mb-3">Cost Estimate</h3>
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-sm text-muted-foreground">Initial investment per acre</p>
                    <p className="text-2xl font-bold text-blue-600 mt-2">{option.costPerAcre}</p>
                    <p className="text-xs text-muted-foreground mt-2">Based on standard specifications</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Crop-Infrastructure Compatibility</CardTitle>
          <CardDescription>Which crops work best with each infrastructure type</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3 font-semibold">Crop</th>
                  <th className="text-center py-2 px-3 font-semibold">Polyhouse</th>
                  <th className="text-center py-2 px-3 font-semibold">Shade Net</th>
                  <th className="text-center py-2 px-3 font-semibold">Open Field</th>
                </tr>
              </thead>
              <tbody>
                {cropCompatibility.map((row, idx) => (
                  <tr key={idx} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-3 font-medium">{row.crop}</td>
                    <td className="py-2 px-3 text-center">
                      {row.polyhouse ? (
                        <CheckCircle className="h-5 w-5 text-green-600 inline" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-gray-300 inline" />
                      )}
                    </td>
                    <td className="py-2 px-3 text-center">
                      {row.shadeNet ? (
                        <CheckCircle className="h-5 w-5 text-green-600 inline" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-gray-300 inline" />
                      )}
                    </td>
                    <td className="py-2 px-3 text-center">
                      {row.openField ? (
                        <CheckCircle className="h-5 w-5 text-green-600 inline" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-gray-300 inline" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
