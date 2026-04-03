"use client"

import { useState, useEffect, useCallback, type ReactNode } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { api, siteEvaluationsApi, settingsApi, type SiteEvaluation, type InfrastructureConfig } from "@/lib/api"
import { ArrowLeft, AlertCircle, FileDown } from "lucide-react"

const RECOMMENDATION_OPTIONS = ["Polyhouse", "Shade Net", "Open Field"] as const

function infraKeyFromReco(s: string | undefined): keyof InfrastructureConfig | null {
  if (!s) return null
  const t = s.toLowerCase().replace(/\s+/g, "_")
  if (t === "polyhouse") return "polyhouse"
  if (t === "shade_net" || t === "shadenet") return "shade_net"
  if (t === "open_field" || t === "openfield") return "open_field"
  return null
}

function computeCostFromInfra(
  area: number,
  recommendation: string | undefined,
  infra: InfrastructureConfig | null
): number | undefined {
  const k = infraKeyFromReco(recommendation)
  if (!k || !infra) return undefined
  const row = infra[k]
  return Math.round((area * (row.minCost + row.maxCost)) / 2)
}

function computeCostFromSnapshot(
  area: number,
  units: number,
  snap: { minCost: number; maxCost: number }
): number {
  const u = Math.max(1, units)
  return Math.round((area * (snap.minCost + snap.maxCost) * u) / 2)
}

/** Map API/DB values (e.g. polyhouse) to Select option labels. */
function toRecommendationSelectLabel(s: string | undefined): string {
  const k = infraKeyFromReco(s)
  if (k === "polyhouse") return "Polyhouse"
  if (k === "shade_net") return "Shade Net"
  if (k === "open_field") return "Open Field"
  return s ?? ""
}

function statusPillClass(status: string): string {
  switch (status) {
    case "approved":
      return "bg-green-100 text-green-800 ring-1 ring-green-200/60"
    case "submitted":
      return "bg-blue-100 text-blue-800 ring-1 ring-blue-200/60"
    case "draft":
      return "bg-gray-100 text-gray-700 ring-1 ring-gray-200/80"
    case "rejected":
      return "bg-red-100 text-red-800 ring-1 ring-red-200/60"
    default:
      return "bg-gray-100 text-gray-600 ring-1 ring-gray-200/80"
  }
}

function KvRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium text-foreground break-words">{children}</p>
    </div>
  )
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
  const [recommendationLoading, setRecommendationLoading] = useState(false)
  const [recommendationError, setRecommendationError] = useState<string | null>(null)
  const [recommendedType, setRecommendedType] = useState<string | null>(null)
  const [feasibilityScore, setFeasibilityScore] = useState<number | null>(null)
  const [costLoading, setCostLoading] = useState(false)
  const [costError, setCostError] = useState<string | null>(null)
  const [backendCost, setBackendCost] = useState<{
    infrastructureType: string
    costPerAcre: number
    finalInvestment: number
    annualProfit: number
    roiMonths: number
  } | null>(null)
  const [infraConfig, setInfraConfig] = useState<InfrastructureConfig | null>(null)
  const [infraLoading, setInfraLoading] = useState(false)

  useEffect(() => {
    if (!evaluation) return
    if (evaluation.infrastructureSnapshot) {
      setInfraConfig(null)
      setInfraLoading(false)
      return
    }
    let cancelled = false
    setInfraLoading(true)
    settingsApi
      .getInfrastructure()
      .then((res) => {
        if (!cancelled && res?.data) setInfraConfig(res.data)
      })
      .finally(() => {
        if (!cancelled) setInfraLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [evaluation])

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const res = await siteEvaluationsApi.get(id)
      if (res.success && res.data) {
        const e = res.data
        const proposal = (e as { proposal?: { infrastructureType?: string; investmentValue?: number } }).proposal
        const siteRef = typeof e.siteId === "object" && e.siteId && "area" in e.siteId ? e.siteId : null
        const area = (siteRef as { area?: number })?.area ?? (e as { area?: number }).area ?? 0
        setEvaluation(e)
        setSlope(
          (e as { slopePercentage?: number }).slopePercentage != null
            ? String((e as { slopePercentage: number }).slopePercentage)
            : (e as { slope?: number }).slope != null
              ? String((e as { slope: number }).slope)
              : ""
        )
        setInfrastructureRecommendation(
          toRecommendationSelectLabel(
            (e as { infrastructureRecommendation?: string }).infrastructureRecommendation ??
              proposal?.infrastructureType ??
              ""
          )
        )
        const snap = e.infrastructureSnapshot
        const units = typeof e.numberOfUnits === "number" && e.numberOfUnits >= 1 ? e.numberOfUnits : 1
        if (
          snap &&
          typeof snap.minCost === "number" &&
          typeof snap.maxCost === "number" &&
          Number.isFinite(snap.minCost) &&
          Number.isFinite(snap.maxCost)
        ) {
          setCostEstimate(computeCostFromSnapshot(area, units, snap))
        } else {
          setCostEstimate(
            (e as { costEstimate?: number }).costEstimate ?? proposal?.investmentValue ?? undefined
          )
        }
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
    if (evaluation == null || evaluation.infrastructureSnapshot || !infraConfig) return
    const siteRef = typeof evaluation.siteId === "object" && evaluation.siteId && "area" in evaluation.siteId ? evaluation.siteId : null
    const area = (siteRef as { area?: number })?.area ?? (evaluation as { area?: number }).area ?? 0
    const reco =
      infrastructureRecommendation ||
      (evaluation as { infrastructureRecommendation?: string }).infrastructureRecommendation ||
      undefined
    const cost = computeCostFromInfra(area, reco, infraConfig)
    if (cost != null) setCostEstimate(cost)
  }, [evaluation, infrastructureRecommendation, infraConfig])

  useEffect(() => {
    if (!id) return

    let cancelled = false

    async function loadRecommendationAndCost() {
      try {
        setRecommendationLoading(true)
        setRecommendationError(null)

        const recRes = await api.post<{
          success: boolean
          data: {
            siteId: string
            area: number
            slope: number
            infrastructureType: string
            estimatedCost: number
            roiMonths: number
            feasibilityScore: number
          }
        }>("/api/proposals/recommend", { siteId: id })

        if (!cancelled && recRes.data?.success && recRes.data.data) {
          const rec = recRes.data.data
          setRecommendedType(rec.infrastructureType)
          setFeasibilityScore(rec.feasibilityScore)
        }
      } catch (err) {
        if (!cancelled) {
          setRecommendationError(
            err instanceof Error ? err.message : "Failed to load recommendation"
          )
        }
      } finally {
        if (!cancelled) {
          setRecommendationLoading(false)
        }
      }

      try {
        setCostLoading(true)
        setCostError(null)

        const costRes = await api.get<{
          success: boolean
          data: {
            siteId: string
            infrastructureType: string
            area: number
            costPerAcre: number
            investment: number
            finalInvestment: number
            annualProfit: number
            roiMonths: number
          }
        }>(`/api/cost/${id}`)

        if (!cancelled && costRes.data?.success && costRes.data.data) {
          const c = costRes.data.data
          setBackendCost({
            infrastructureType: c.infrastructureType,
            costPerAcre: c.costPerAcre,
            finalInvestment: c.finalInvestment,
            annualProfit: c.annualProfit,
            roiMonths: c.roiMonths,
          })
        }
      } catch (err) {
        if (!cancelled) {
          setCostError(err instanceof Error ? err.message : "Failed to load cost details")
        }
      } finally {
        if (!cancelled) {
          setCostLoading(false)
        }
      }
    }

    void loadRecommendationAndCost()

    return () => {
      cancelled = true
    }
  }, [id])

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

  const needsLiveInfra = evaluation != null && !evaluation.infrastructureSnapshot
  if (needsLiveInfra && (infraLoading || !infraConfig)) {
    return (
      <div className="space-y-6">
        <Link
          href="/dashboard/farms"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Farms
        </Link>
        <p className="text-muted-foreground">Loading infrastructure settings…</p>
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

  const sitePop =
    evaluation.siteId && typeof evaluation.siteId === "object" && "name" in evaluation.siteId
      ? (evaluation.siteId as { name?: string })
      : null
  const farmPop =
    evaluation.farmId && typeof evaluation.farmId === "object" && "name" in evaluation.farmId
      ? (evaluation.farmId as { name?: string })
      : null
  const farmSiteLine = [farmPop?.name, sitePop?.name].filter(Boolean).join(" • ")

  const slopeDisplay =
    slope !== ""
      ? slope
      : (evaluation as { slopePercentage?: number }).slopePercentage != null
        ? String((evaluation as { slopePercentage: number }).slopePercentage)
        : (evaluation as { slope?: number }).slope != null
          ? String((evaluation as { slope: number }).slope)
          : "—"

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:px-6 space-y-8">
      <Link
        href="/dashboard/farms"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Farms
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between border-b border-border pb-6">
        <div className="min-w-0 space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{evaluation.name}</h1>
          {farmSiteLine ? (
            <p className="text-sm text-muted-foreground">{farmSiteLine}</p>
          ) : (
            <p className="text-sm text-muted-foreground">Site evaluation</p>
          )}
        </div>
        <span
          className={`inline-flex w-fit shrink-0 items-center rounded-full px-3 py-1 text-sm font-medium capitalize ${statusPillClass(evaluation.status)}`}
        >
          {evaluation.status}
        </span>
      </div>

      {/* Evaluation data */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Evaluation data
        </h2>
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <KvRow label="Name">{evaluation.name ?? "—"}</KvRow>
            <KvRow label="Area">
              {evaluation.area != null ? `${evaluation.area} acres` : "—"}
            </KvRow>
            <KvRow label="Soil type">{evaluation.soilType ?? "—"}</KvRow>
            <KvRow label="Water availability">{evaluation.waterAvailability ?? "—"}</KvRow>
            <KvRow label="Sun exposure">{evaluation.sunExposure ?? "—"}</KvRow>
            <KvRow label="Slope %">{slopeDisplay}</KvRow>
            {(evaluation as { elevationMeters?: number }).elevationMeters != null && (
              <KvRow label="Elevation (m)">
                {String((evaluation as { elevationMeters: number }).elevationMeters)}
              </KvRow>
            )}
            {evaluation.cropType ? <KvRow label="Crop">{evaluation.cropType}</KvRow> : null}
            {typeof evaluation.numberOfUnits === "number" && evaluation.numberOfUnits > 1 ? (
              <KvRow label="Units">{evaluation.numberOfUnits}</KvRow>
            ) : null}
          </div>
        </div>
      </section>

      {/* Infrastructure */}
      <section className="space-y-3 border-t border-border pt-8">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Infrastructure
        </h2>
        <div className="rounded-lg border bg-card p-6 shadow-sm space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="slope">Slope (%)</Label>
              <Input
                id="slope"
                type="number"
                value={slope}
                onChange={(e) => setSlope(e.target.value)}
                placeholder="Slope %"
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
        </div>
      </section>

      {/* Cost */}
      <section className="space-y-3 border-t border-border pt-8">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cost</h2>
        <div className="rounded-lg border bg-card p-6 shadow-sm space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <KvRow label="Cost estimate">
              {costEstimate != null ? `₹${costEstimate.toLocaleString("en-IN")}` : "—"}
            </KvRow>
          </div>
          {evaluation.infrastructureSnapshot && (
            <p className="text-xs text-muted-foreground border-t border-border pt-4">
              From evaluation snapshot: ₹
              {Math.round(
                (evaluation.infrastructureSnapshot.minCost + evaluation.infrastructureSnapshot.maxCost) / 2
              ).toLocaleString("en-IN")}{" "}
              /acre (avg) • ROI: {evaluation.infrastructureSnapshot.roiMonths} months
              {typeof evaluation.numberOfUnits === "number" && evaluation.numberOfUnits > 1
                ? ` • ${evaluation.numberOfUnits} units`
                : ""}
            </p>
          )}
          {recommendationLoading && (
            <p className="text-xs text-muted-foreground">Loading recommendation…</p>
          )}
          {!recommendationLoading && recommendationError && (
            <p className="text-xs text-red-600">Failed to load recommendation: {recommendationError}</p>
          )}
          {!recommendationLoading && !recommendationError && recommendedType && (
            <p className="text-xs text-muted-foreground">
              Recommended: <span className="font-medium">{recommendedType}</span>
              {feasibilityScore != null && (
                <> • Feasibility score: {feasibilityScore.toFixed(1)}%</>
              )}
            </p>
          )}
          {!costLoading && backendCost && (
            <p className="text-xs text-muted-foreground">
              Backend cost: {backendCost.infrastructureType} • ₹
              {backendCost.costPerAcre.toLocaleString("en-IN")} /acre • Final: ₹
              {backendCost.finalInvestment.toLocaleString("en-IN")} • Annual profit: ₹
              {backendCost.annualProfit.toLocaleString("en-IN")} • ROI: {backendCost.roiMonths.toFixed(1)}{" "}
              months
            </p>
          )}
          {costLoading && <p className="text-xs text-muted-foreground">Loading cost details…</p>}
          {!costLoading && costError && (
            <p className="text-xs text-red-600">Failed to load cost details: {costError}</p>
          )}
        </div>
      </section>

      {/* Actions */}
      <section className="space-y-3 border-t border-border pt-8">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Actions</h2>
        <div className="flex flex-wrap gap-2">
          <Button
            className="bg-green-600 text-white hover:bg-green-700"
            onClick={handleSaveDraft}
            disabled={saving || evaluation.status === "submitted"}
          >
            {saving ? "Saving…" : "Save Draft"}
          </Button>
          <Button
            className="bg-green-600 text-white hover:bg-green-700"
            onClick={handleSubmit}
            disabled={saving || evaluation.status === "submitted"}
          >
            {saving ? "Submitting…" : "Submit Evaluation"}
          </Button>
          {evaluation.status === "submitted" && (
            <Button
              className="bg-green-600 text-white hover:bg-green-700"
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
            >
              <FileDown className="h-4 w-4 mr-2" />
              {downloadingPdf ? "Downloading…" : "Download Proposal PDF"}
            </Button>
          )}
        </div>
      </section>
    </div>
  )
}
