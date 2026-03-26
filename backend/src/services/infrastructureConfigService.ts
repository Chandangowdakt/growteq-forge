import fs from "fs"
import path from "path"
import { Infrastructure, type InfrastructureKind } from "../models/Infrastructure"
import { InfraConfigMeta, INFRA_CONFIG_VERSION_ID } from "../models/InfraConfigMeta"

export type InfraCosts = { minCost: number; maxCost: number; roiMonths: number }

const DEFAULT_ROWS: Record<InfrastructureKind, InfraCosts> = {
  polyhouse: { minCost: 2_500_000, maxCost: 3_500_000, roiMonths: 18 },
  shade_net: { minCost: 200_000, maxCost: 500_000, roiMonths: 6 },
  open_field: { minCost: 50_000, maxCost: 200_000, roiMonths: 3 },
}

const KINDS: InfrastructureKind[] = ["polyhouse", "shade_net", "open_field"]

export function avgCostPerAcre(c: InfraCosts): number {
  return Math.round((c.minCost + c.maxCost) / 2)
}

/** Normalize UI/API strings to infrastructure keys. */
export function normalizeInfrastructureKey(raw: string | undefined | null): InfrastructureKind | null {
  if (typeof raw !== "string" || !raw.trim()) return null
  const n = raw.trim().toLowerCase().replace(/\s+/g, "_")
  if (n === "shadenet") return "shade_net"
  if (n === "openfield") return "open_field"
  if (n === "polyhouse" || n === "shade_net" || n === "open_field") return n
  return null
}

export function isValidInfraCosts(c: InfraCosts): boolean {
  return (
    Number.isFinite(c.minCost) &&
    c.minCost >= 0 &&
    Number.isFinite(c.maxCost) &&
    c.maxCost >= 0 &&
    Number.isFinite(c.roiMonths) &&
    c.roiMonths >= 0
  )
}

export async function getInfrastructureConfigVersion(): Promise<number> {
  const doc = await InfraConfigMeta.findById(INFRA_CONFIG_VERSION_ID).lean()
  return doc?.version ?? 1
}

/** Call after persisting infrastructure settings so new evaluations can record the new version. */
export async function bumpInfrastructureConfigVersion(): Promise<number> {
  const doc = await InfraConfigMeta.findOneAndUpdate(
    { _id: INFRA_CONFIG_VERSION_ID },
    { $inc: { version: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean()
  return doc?.version ?? 1
}

function loadLegacyJsonDefaults(): Partial<Record<InfrastructureKind, InfraCosts>> | null {
  const jsonPath = path.join(__dirname, "../config/infrastructure.json")
  if (!fs.existsSync(jsonPath)) return null
  try {
    const parsed = JSON.parse(fs.readFileSync(jsonPath, "utf8")) as Record<
      string,
      { minCostPerAcre?: number; maxCostPerAcre?: number; minCost?: number; maxCost?: number; roiMonths?: number }
    >
    const out: Partial<Record<InfrastructureKind, InfraCosts>> = {}
    for (const kind of KINDS) {
      const p = parsed[kind]
      if (!p) continue
      const min = p.minCost ?? p.minCostPerAcre
      const max = p.maxCost ?? p.maxCostPerAcre
      if (min != null && max != null && p.roiMonths != null) {
        out[kind] = { minCost: Number(min), maxCost: Number(max), roiMonths: Number(p.roiMonths) }
      }
    }
    return Object.keys(out).length ? out : null
  } catch {
    return null
  }
}

/** Ensure three rows exist (idempotent). Seeds from legacy JSON once if DB is empty. */
export async function ensureInfrastructureDocuments(): Promise<void> {
  const count = await Infrastructure.countDocuments()
  const legacy = count === 0 ? loadLegacyJsonDefaults() : null

  for (const kind of KINDS) {
    const defaults = legacy?.[kind] ?? DEFAULT_ROWS[kind]
    await Infrastructure.findOneAndUpdate(
      { type: kind },
      {
        $setOnInsert: {
          type: kind,
          minCost: defaults.minCost,
          maxCost: defaults.maxCost,
          roiMonths: defaults.roiMonths,
        },
      },
      { upsert: true }
    )
  }
}

export async function getInfrastructureMap(): Promise<Record<InfrastructureKind, InfraCosts>> {
  await ensureInfrastructureDocuments()
  const docs = await Infrastructure.find().lean()
  const out = { ...DEFAULT_ROWS }
  for (const d of docs) {
    const t = d.type as InfrastructureKind
    if (KINDS.includes(t)) {
      out[t] = {
        minCost: d.minCost,
        maxCost: d.maxCost,
        roiMonths: d.roiMonths,
      }
    }
  }
  return out
}
