"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { formatINR } from "@/lib/utils"
import { toast } from "@/hooks/use-toast"
import { siteEvaluationsApi } from "@/lib/api"

type InfrastructureKey = "polyhouse" | "shade_net" | "open_field"

const INFRA_COSTS: Record<InfrastructureKey, { perAcre: number; roiMonths: number; returnMultiplier: number }> =
  {
    polyhouse: { perAcre: 2_500_000, roiMonths: 18, returnMultiplier: 1.375 },
    shade_net: { perAcre: 200_000, roiMonths: 6, returnMultiplier: 1.15 },
    open_field: { perAcre: 50_000, roiMonths: 3, returnMultiplier: 1.15 },
  }

interface SiteData {
  _id: string
  name: string
  area: number
  slope?: number
}

const baseURL =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL) || "http://localhost:5000"

export default function NewSiteEvaluationPage() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const siteId = searchParams.get("siteId") || ""
  const farmId = searchParams.get("farmId") || ""

  const [site, setSite] = useState<SiteData | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [infrastructureType, setInfrastructureType] = useState<InfrastructureKey | null>(null)
  const [numberOfUnits, setNumberOfUnits] = useState(1)
  const [cropType, setCropType] = useState<string>("Tomato")
  const [soilType, setSoilType] = useState<string>("Loamy")
  const [waterAvailability, setWaterAvailability] = useState<string>("Borewell")
  const [slope, setSlope] = useState<string>("2.5")
  const [notes, setNotes] = useState<string>("")

  const loadSite = useCallback(async () => {
    if (!siteId) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("forge_token") : null
      const res = await fetch(`${baseURL}/api/sites/${siteId}`, {
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })
      if (!res.ok) throw new Error("Failed to load site")
      const json = await res.json()
      const data = json?.data as SiteData | undefined
      if (!data) throw new Error("Site not found")
      setSite(data)
      if (typeof data.slope === "number") {
        setSlope(String(data.slope))
      } else {
        setSlope("2.5")
      }
    } catch (err) {
      console.error(err)
      toast({
        title: "Failed to load site",
        description: "Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [siteId])

  useEffect(() => {
    void loadSite()
  }, [loadSite])

  const { costPerAcre, totalInvestment, expectedReturn, roiMonths, profit } = useMemo(() => {
    if (!site || !infrastructureType || !INFRA_COSTS[infrastructureType]) {
      return {
        costPerAcre: 0,
        totalInvestment: 0,
        expectedReturn: 0,
        roiMonths: 0,
        profit: 0,
      }
    }
    const cfg = INFRA_COSTS[infrastructureType]
    const costPerAcreValue = cfg.perAcre
    const totalInv = site.area * costPerAcreValue * Math.max(1, numberOfUnits || 0)
    const expected = totalInv * cfg.returnMultiplier
    const profitValue = expected - totalInv
    return {
      costPerAcre: costPerAcreValue,
      totalInvestment: totalInv,
      expectedReturn: expected,
      roiMonths: cfg.roiMonths,
      profit: profitValue,
    }
  }, [site, infrastructureType, numberOfUnits])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!siteId || !farmId || !infrastructureType || !site) return
    if (!soilType || !waterAvailability || !slope) return

    setSubmitting(true)
    try {
      const slopeValue = Number(slope)
      const units = Math.max(1, numberOfUnits || 0)

      console.log("Submitting evaluation with siteId:", siteId)
      console.log("Submitting evaluation with farmId:", farmId)

      const res = await siteEvaluationsApi.create({
        siteId,
        farmId,
        soilType,
        waterAvailability,
        slopePercentage: slopeValue,
        notes: notes || undefined,
        // extra fields passed through to backend
        infrastructureType,
        numberOfUnits: units,
        cropType,
        calculatedInvestment: totalInvestment || 0,
      } as any)

      if (res.success && res.data) {
        const cfg = INFRA_COSTS[infrastructureType]
        toast({
          title: "Evaluation submitted!",
          description: `Investment: ${formatINR(totalInvestment || 0)} | ROI: ${cfg.roiMonths} months`,
        })
        // Force hard navigation to ensure fresh data
        window.location.href = `/dashboard/farms/${farmId}/sites/${siteId}`
      }
    } catch (err) {
      console.error(err)
      toast({
        title: "Failed to submit evaluation",
        description: "Please try again.",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const infraLabel = (key: InfrastructureKey) => {
    switch (key) {
      case "polyhouse":
        return "Polyhouse"
      case "shade_net":
        return "Shade Net"
      case "open_field":
        return "Open Field"
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Link
          href="/dashboard/site-evaluations"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          Back to Evaluations
        </Link>
        <p className="text-muted-foreground text-sm">Loading site…</p>
      </div>
    )
  }

  if (!site || !siteId || !farmId) {
    return (
      <div className="space-y-6">
        <Link
          href="/dashboard/site-evaluations"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          Back to Evaluations
        </Link>
        <Card className="border-l-4 border-l-destructive">
          <CardHeader>
            <CardTitle>Site not found</CardTitle>
            <CardDescription>
              The requested site could not be loaded. Please start the evaluation again from the
              site page.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">New Site Evaluation</h1>
          <p className="text-muted-foreground">
            {site.name} • {site.area} acres
          </p>
        </div>
        <Badge variant="outline">Step 2 of 2 — Evaluation</Badge>
      </div>

      <form
        onSubmit={handleSubmit}
        className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)] items-start"
      >
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Infrastructure Type</CardTitle>
              <CardDescription>Select the structure you plan to install</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              {(["polyhouse", "shade_net", "open_field"] as InfrastructureKey[]).map((key) => {
                const selected = infrastructureType === key
                const cfg = INFRA_COSTS[key]
                return (
                  <button
                    type="button"
                    key={key}
                    onClick={() => setInfrastructureType(key)}
                    className={`flex flex-col gap-1 rounded-xl border px-3 py-3 text-left text-sm transition ${
                      selected
                        ? "border-[#387F43] bg-[#387F43]/5 shadow-sm"
                        : "border-border hover:border-[#387F43]/60 hover:bg-muted/40"
                    }`}
                  >
                    <span className="font-semibold">{infraLabel(key)}</span>
                    <span className="text-xs text-muted-foreground">
                      Cost per acre: {formatINR(cfg.perAcre)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ROI: {cfg.roiMonths} months
                    </span>
                  </button>
                )
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Site Conditions</CardTitle>
              <CardDescription>Describe the planned setup and field conditions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="units">Number of Units</Label>
                  <Input
                    id="units"
                    type="number"
                    min={1}
                    value={numberOfUnits}
                    onChange={(e) => {
                      const v = Number(e.target.value)
                      setNumberOfUnits(Number.isFinite(v) && v > 0 ? v : 1)
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    How many structures (polyhouse/shade net/open field blocks) will be installed?
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Crop Type</Label>
                  <Select value={cropType} onValueChange={setCropType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select crop" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Tomato">Tomato</SelectItem>
                      <SelectItem value="Cucumber">Cucumber</SelectItem>
                      <SelectItem value="Bell Pepper">Bell Pepper</SelectItem>
                      <SelectItem value="Lettuce">Lettuce</SelectItem>
                      <SelectItem value="Wheat">Wheat</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Soil Type</Label>
                  <Select value={soilType} onValueChange={setSoilType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select soil" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Clay">Clay</SelectItem>
                      <SelectItem value="Sandy">Sandy</SelectItem>
                      <SelectItem value="Loamy">Loamy</SelectItem>
                      <SelectItem value="Black Cotton">Black Cotton</SelectItem>
                      <SelectItem value="Red">Red</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Water Availability</Label>
                  <Select value={waterAvailability} onValueChange={setWaterAvailability}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select source" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Borewell">Borewell</SelectItem>
                      <SelectItem value="Canal">Canal</SelectItem>
                      <SelectItem value="Rainwater">Rainwater</SelectItem>
                      <SelectItem value="River">River</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slope">Slope %</Label>
                  <Input
                    id="slope"
                    type="number"
                    min={0}
                    max={100}
                    value={slope}
                    onChange={(e) => setSlope(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes (optional)</Label>
                <textarea
                  id="notes"
                  className="min-h-[96px] w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="Any observations or constraints for this site…"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="sticky top-20">
            <CardHeader>
              <CardTitle>Cost Estimate</CardTitle>
              <CardDescription>Live estimate based on site area and infrastructure</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Site</span>
                  <span className="font-medium">{site.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Area</span>
                  <span className="font-medium">{site.area} acres</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Infrastructure</span>
                  <span className="font-medium">
                    {infrastructureType ? infraLabel(infrastructureType) : "Not selected"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Units</span>
                  <span className="font-medium">{numberOfUnits}</span>
                </div>
              </div>

              <hr className="my-2" />

              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cost per acre</span>
                  <span className="font-semibold">
                    {infrastructureType ? formatINR(costPerAcre) : "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Investment</span>
                  <span className="font-semibold">
                    {infrastructureType ? formatINR(totalInvestment || 0) : "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Expected Return</span>
                  <span className="font-semibold">
                    {infrastructureType ? formatINR(expectedReturn || 0) : "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ROI Timeline</span>
                  <span className="font-semibold">
                    {infrastructureType ? `${roiMonths} months` : "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Profit</span>
                  <span className="font-semibold">
                    {infrastructureType ? formatINR(profit || 0) : "—"}
                  </span>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-[#387F43] hover:bg-[#2d6535]"
                disabled={!infrastructureType || submitting}
              >
                {submitting ? "Submitting…" : "Submit Evaluation"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </form>
    </div>
  )
}

