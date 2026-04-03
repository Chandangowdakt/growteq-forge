"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DashboardPageGuard } from "@/components/dashboard/dashboard-page-guard"
import { proposalsApi, type Proposal } from "@/lib/api"

function evalIdFromPopulated(
  siteEvaluationId: Proposal["siteEvaluationId"] | unknown
): string | null {
  if (typeof siteEvaluationId === "string") return siteEvaluationId
  if (
    siteEvaluationId &&
    typeof siteEvaluationId === "object" &&
    "_id" in siteEvaluationId &&
    typeof (siteEvaluationId as { _id: unknown })._id === "string"
  ) {
    return (siteEvaluationId as { _id: string })._id
  }
  return null
}

function formatContentValue(val: unknown): string {
  if (val === null || val === undefined) return "—"
  if (typeof val === "object") {
    try {
      return JSON.stringify(val, null, 2)
    } catch {
      return String(val)
    }
  }
  return String(val)
}

function labelFromKey(key: string): string {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()).trim()
}

function ProposalDetailContent() {
  const params = useParams()
  const router = useRouter()
  const id = typeof params.id === "string" ? params.id : ""
  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    proposalsApi
      .get(id)
      .then((res) => {
        if (cancelled) return
        if (res.success && res.data) setProposal(res.data)
        else setError("Proposal not found.")
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load proposal.")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  const evalId = proposal ? evalIdFromPopulated(proposal.siteEvaluationId) : null

  if (loading) {
    return (
      <div className="space-y-6">
        <Button type="button" variant="ghost" size="sm" className="gap-1 -ml-2" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <p className="text-sm text-muted-foreground">Loading proposal…</p>
      </div>
    )
  }

  if (error || !proposal) {
    return (
      <div className="space-y-6">
        <Button type="button" variant="ghost" size="sm" className="gap-1 -ml-2" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <p className="text-sm text-red-600">{error ?? "Proposal not found."}</p>
      </div>
    )
  }

  const extended = proposal as Proposal & {
    infrastructureType?: string
    investmentValue?: number
    roiMonths?: number
  }

  const metaRows: { label: string; value: string }[] = []
  if (extended.infrastructureType) {
    metaRows.push({ label: "Infrastructure", value: extended.infrastructureType })
  }
  if (typeof extended.investmentValue === "number" && Number.isFinite(extended.investmentValue)) {
    metaRows.push({
      label: "Investment (est.)",
      value: `₹${extended.investmentValue.toLocaleString("en-IN")}`,
    })
  }
  if (typeof extended.roiMonths === "number" && Number.isFinite(extended.roiMonths)) {
    metaRows.push({ label: "ROI (months)", value: String(extended.roiMonths) })
  }

  const contentEntries =
    proposal.content && typeof proposal.content === "object" && !Array.isArray(proposal.content)
      ? Object.entries(proposal.content as Record<string, unknown>)
      : []

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="ghost" size="sm" className="gap-1 -ml-2" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        {evalId ? (
          <Button variant="outline" size="sm" asChild>
            <Link href={`/dashboard/site-evaluations/${evalId}`}>Open site evaluation</Link>
          </Button>
        ) : null}
      </div>

      <div>
        <h1 className="text-2xl font-semibold text-foreground">{proposal.title || "Proposal"}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge variant="outline">{proposal.status}</Badge>
        </div>
      </div>

      {(metaRows.length > 0 || contentEntries.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {metaRows.length > 0 && (
              <dl className="space-y-2">
                {metaRows.map((row) => (
                  <div key={row.label} className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4 border-b border-border pb-2 last:border-0">
                    <dt className="text-sm text-muted-foreground">{row.label}</dt>
                    <dd className="text-sm font-medium text-right sm:text-right">{row.value}</dd>
                  </div>
                ))}
              </dl>
            )}
            {contentEntries.length > 0 && (
              <div className="space-y-2 pt-2">
                {contentEntries.map(([key, val]) => (
                  <div
                    key={key}
                    className="flex flex-col gap-1 border-b border-border pb-3 last:border-0"
                  >
                    <span className="text-sm text-muted-foreground">{labelFromKey(key)}</span>
                    <pre className="text-sm font-medium whitespace-pre-wrap break-words font-sans">
                      {formatContentValue(val)}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default function ProposalDetailPage() {
  return (
    <DashboardPageGuard module="proposals">
      <ProposalDetailContent />
    </DashboardPageGuard>
  )
}
