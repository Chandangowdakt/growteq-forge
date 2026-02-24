export type Availability = "Y" | "N" | "ADDON" | "ALACARTE"

export const PLANS = ["Starter", "Accelerator", "Premium", "Enterprise"] as const
export type PlanType = (typeof PLANS)[number]

export const FEATURE_MATRIX = {
  "Login MFA": ["Y", "Y", "Y", "ALACARTE"],
  "Login with Google/MS": ["Y", "Y", "Y", "ALACARTE"],
  "PO Acceptance": ["N", "Y", "Y", "ALACARTE"],

  "Consent Management": ["N", "Y", "Y", "ALACARTE"],
  "Email Notifications": ["Y", "Y", "Y", "ALACARTE"],
  "SMS Notifications": ["Y", "Y", "Y", "ALACARTE"],
  "WhatsApp Notifications": ["N", "N", "N", "ALACARTE"],

  "ASN Creation": {
    "Approval Via Email": ["Y", "Y", "Y", "ALACARTE"],
    "Approval Via SSC": ["Y", "Y", "Y", "ALACARTE"],
    "No Approval": ["Y", "Y", "Y", "ALACARTE"],
  },

  Help: ["Y", "Y", "Y", "ALACARTE"],
  "Add Users": ["N", "N", "Y", "ALACARTE"],
  "Statement / Doc Upload": ["Y", "Y", "Y", "ALACARTE"],

  "OCR Enable": ["ADDON", "ADDON", "Y", "ALACARTE"],
  "Verifications Enable": ["ADDON", "ADDON", "Y", "ALACARTE"],

  "Support Plan": ["Silver", "Gold", "Gold", "Platinum"],

  Financing: ["Y", "Y", "Y", "ALACARTE"],
  "Broadcast Messages": ["Y", "Y", "Y", "ALACARTE"],
  Localisation: ["N", "Y", "Y", "ALACARTE"],
  "Mobile Responsive": ["Y", "Y", "Y", "ALACARTE"],
  "Mobile App": ["N", "Y", "Y", "ALACARTE"],

  "Audit Trail": {
    Basic: ["Y", "Y", "N", "ALACARTE"],
    Advance: ["N", "N", "Y", "ALACARTE"],
  },

  DMS: ["N", "N", "Y", "ALACARTE"],
  "Set Storage Limit": ["N", "N", "N", "ALACARTE"],
} as const

export type FeatureKey = keyof typeof FEATURE_MATRIX

export const getFeatureAvailability = (feature: FeatureKey, planIndex: number): Availability => {
  const featureConfig = FEATURE_MATRIX[feature]
  if (Array.isArray(featureConfig)) {
    return featureConfig[planIndex] as Availability
  }
  return "N"
}

export const getSubFeatureAvailability = (feature: FeatureKey, subFeature: string, planIndex: number): Availability => {
  const featureConfig = FEATURE_MATRIX[feature]
  if (typeof featureConfig === "object" && !Array.isArray(featureConfig)) {
    const subFeatureConfig = featureConfig[subFeature as keyof typeof featureConfig]
    if (Array.isArray(subFeatureConfig)) {
      return subFeatureConfig[planIndex] as Availability
    }
  }
  return "N"
}
