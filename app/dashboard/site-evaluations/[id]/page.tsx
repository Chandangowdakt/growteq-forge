"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { siteEvaluationsApi, type SiteEvaluation } from "@/lib/api"
import { ArrowLeft, AlertCircle, FileDown } from "lucide-react"

const COST_PER_ACRE: Record<string, number> = {
  Polyhouse: 800000,
  "Shade Net": 400000,
  "Open Field": 150000,
}

const RECOMMENDATION_OPTIONS = ["Polyhouse", "Shade Net", "Open Field"] as const

function computeCost(area: number, recommendation: string | undefined): number | undefined {
  if (!recommendation || !(recommendation in COST_PER_ACRE)) return undefined
  return Math.round(area * COST_PER_ACRE[recommendation])
}

export default function SiteEvaluationDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = typeof params.id === "string" ? params.id : ""
  const [evaluation, setEvaluation] = useState<SiteEvaluation | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [slope, setSlope] = useState<string>("")
  const [infrastructureRecommendation, setInfrastructureRecommendation] = useState<string>("")
  const [costEstimate, setCostEstimate] = useState<number | undefined>(undefined)
  const [saving, setSaving] = useState(false)
  const [downloadingPdf, setDownloadingPdf] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const res = await siteEvaluationsApi.get(id)
      if (res.success && res.data) {
        const e = res.data
        setEvaluation(e)
        setSlope(e.slope != null ? String(e.slope) : "")
        setInfrastructureRecommendation(e.infrastructureRecommendation ?? "")
        setCostEstimate(
          e.costEstimate ?? computeCost(e.area, e.infrastructureRecommendation)
        )
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load evaluation")
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (evaluation == null) return
    const cost = computeCost(
      evaluation.area,
      infrastructureRecommendation || undefined
    )
    setCostEstimate(cost)
  }, [evaluation, infrastructureRecommendation])

  const handleSaveDraft = async () => {
    if (!id || evaluation == null) return
    setSaving(true)
    try {
      await siteEvaluationsApi.update(id, {
        slope: slope === "" ? undefined : Number(slope),
        infrastructureRecommendation: infrastructureRecommendation || undefined,
        costEstimate: costEstimate ?? undefined,
      })
      setEvaluation((prev) =>
        prev ? { ...prev, slope: slope === "" ? undefined : Number(slope), infrastructureRecommendation: infrastructureRecommendation || undefined, costEstimate: costEstimate ?? undefined } : null
      )
    } catch {
      setError("Failed to save")
    } finally {
      setSaving(false)
    }
  }

  const handleSubmit = async () => {
    if (!id || evaluation == null) return
    setSaving(true)
    try {
      await siteEvaluationsApi.update(id, {
        slope: slope === "" ? undefined : Number(slope),
        infrastructureRecommendation: infrastructureRecommendation || undefined,
        costEstimate: costEstimate ?? undefined,
        status: "submitted",
      })
      setEvaluation((prev) =>
        prev ? { ...prev, status: "submitted" as const, slope: slope === "" ? undefined : Number(slope), infrastructureRecommendation: infrastructureRecommendation || undefined, costEstimate: costEstimate ?? undefined } : null
      )
    } catch {
      setError("Failed to submit")
    } finally {
      setSaving(false)
    }
  }

  const handleDownloadPdf = async () => {
    if (!id || !evaluation || evaluation.status !== "submitted") return
    const token = typeof window !== "undefined" ? localStorage.getItem("forge_token") : null
    if (!token) {
      alert("You must be logged in to download the proposal PDF.")
      return
    }
    setDownloadingPdf(true)
    try {
      const baseURL =
        (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL) ||
        "http://localhost:5000"
      const res = await fetch(`${baseURL}/api/proposals/${id}/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        throw new Error(res.statusText || "Download failed")
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `proposal-${evaluation.name.replace(/[^a-zA-Z0-9-_.\s]/g, "-")}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert("Failed to download proposal PDF. Please try again.")
    } finally {
      setDownloadingPdf(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Link
          href="/dashboard/farms"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Farms
        </Link>
        <p className="text-muted-foreground">Loading evaluation…</p>
      </div>
    )
  }

  if (error || !evaluation) {
    return (
      <div className="space-y-6">
        <Link
          href="/dashboard/farms"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Farms
        </Link>
        <Card className="border-l-4 border-l-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Error
            </CardTitle>
            <CardDescription>{error ?? "Evaluation not found"}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => router.push("/dashboard/farms")}>
              Back to Farms
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const statusBadge =
    evaluation.status === "submitted"
      ? "bg-green-100 text-green-800"
      : "bg-orange-100 text-orange-800"

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/farms"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Farms
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Site Evaluation</h1>
          <p className="text-muted-foreground">Edit details and submit</p>
        </div>
        <Badge className={`w-fit ${statusBadge}`}>{evaluation.status}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{evaluation.name}</CardTitle>
          <CardDescription>
            Area: {evaluation.area} acres • Status: {evaluation.status}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <p className="text-sm font-medium">{evaluation.name}</p>
            </div>
            <div className="space-y-2">
              <Label>Area (acres)</Label>
              <p className="text-sm font-medium">{evaluation.area}</p>
            </div>
            <div className="space-y-2">
              <Label>Current status</Label>
              <Badge className={statusBadge}>{evaluation.status}</Badge>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="slope">Slope</Label>
              <Input
                id="slope"
                type="number"
                value={slope}
                onChange={(e) => setSlope(e.target.value)}
                placeholder="Slope"
              />
            </div>
            <div className="space-y-2">
              <Label>Infrastructure recommendation</Label>
              <Select
                value={infrastructureRecommendation || ""}
                onValueChange={setInfrastructureRecommendation}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select option" />
                </SelectTrigger>
                <SelectContent>
                  {RECOMMENDATION_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Cost estimate</Label>
            <p className="text-sm font-medium">
              {costEstimate != null
                ? `₹${costEstimate.toLocaleString()}`
                : "—"}
            </p>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              className="bg-[#387F43] hover:bg-[#2d6535]"
              onClick={handleSaveDraft}
              disabled={saving || evaluation.status === "submitted"}
            >
              {saving ? "Saving…" : "Save Draft"}
            </Button>
            <Button
              variant="outline"
              onClick={handleSubmit}
              disabled={saving || evaluation.status === "submitted"}
            >
              {saving ? "Submitting…" : "Submit Evaluation"}
            </Button>
            {evaluation.status === "submitted" && (
              <Button
                className="bg-[#387F43] hover:bg-[#2d6535]"
                onClick={handleDownloadPdf}
                disabled={downloadingPdf}
              >
                <FileDown className="h-4 w-4 mr-2" />
                {downloadingPdf ? "Downloading…" : "Download Proposal PDF"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
