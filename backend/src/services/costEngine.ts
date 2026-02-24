export type InfrastructureType = "Polyhouse" | "Shade Net" | "Open Field"

const COST_PER_ACRE: Record<InfrastructureType, number> = {
  Polyhouse: 800000,
  "Shade Net": 400000,
  "Open Field": 150000,
}

const VALID_TYPES: InfrastructureType[] = ["Polyhouse", "Shade Net", "Open Field"]

export function calculateCost(area: number, infrastructure: InfrastructureType): number {
  if (area < 0) {
    throw new Error("Area must be >= 0")
  }
  if (!VALID_TYPES.includes(infrastructure as InfrastructureType)) {
    throw new Error(`Invalid infrastructure type: ${infrastructure}`)
  }
  return Math.round(area * COST_PER_ACRE[infrastructure as InfrastructureType])
}
