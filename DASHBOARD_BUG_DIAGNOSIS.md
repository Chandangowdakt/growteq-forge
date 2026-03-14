# Phase 1: Dashboard bug diagnosis

## Expected shape (Overview page)

```ts
{
  totalSites: number,
  totalArea: number,
  totalProposals: number,
  pipelineValue: number,
  averageROI: number,
  revenueTrend: { month: string, value: number }[]
}
```

## What the backend returned before (dashboardController)

- **activeSites** (evaluations.length) → mismatch: frontend expects **totalSites** (sites count)
- **totalLandArea** (sum of evaluation areas) → mismatch: frontend expects **totalArea** (sum of sites.area)
- **totalRevenue** (sum of SiteEvaluation.costEstimate) → mismatch: frontend expects **pipelineValue** (sum of proposals.investmentValue, status !== 'rejected')
- **averageProjectCost** → mismatch: frontend expects **averageROI** (avg proposals.roiMonths)
- **monthlyRevenue** (`{ month, total }[]`) → mismatch: frontend expects **revenueTrend** (`{ month, value }[]`) and from proposals by createdAt (last 6 months)
- **totalProposals** → missing
- **farms**, **evaluations**, **draftEvaluations**, **submitted**, **draftCount**, **submittedCount**, **totalFarms** → not used by Overview

## lib/api.ts

- **dashboardApi.summary()** already expected `totalSites`, `totalArea`, `totalProposals`, `pipelineValue`, `averageROI` but did not include **revenueTrend** in the type.
- Fixed: added `DashboardSummary` interface with `revenueTrend` and use it in `dashboardApi.summary()`.

## Overview page (app/dashboard/overview/page.tsx)

- Already used: `totalSites`, `totalArea`, `totalProposals`, `pipelineValue`, `averageROI`.
- **revenueTrend** was not in the interface or UI; fixed: added to `SummaryData` and wired to a bar chart.

## Field mismatches summary

| Frontend expects | Backend was sending | Fix |
|------------------|---------------------|-----|
| totalSites       | activeSites         | Now: Site.countDocuments() |
| totalArea        | totalLandArea       | Now: Site.aggregate $sum area |
| totalProposals   | (missing)           | Now: Proposal.countDocuments() |
| pipelineValue    | totalRevenue        | Now: Proposal aggregate $sum investmentValue (status !== 'rejected') |
| averageROI       | averageProjectCost  | Now: Proposal aggregate $avg roiMonths |
| revenueTrend     | monthlyRevenue      | Now: Proposal aggregate by month(createdAt), last 6 months, { month, value } |
