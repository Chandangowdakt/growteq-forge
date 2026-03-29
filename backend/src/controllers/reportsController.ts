import fs from "fs"
import path from "path"
import mongoose from "mongoose"
import sharp from "sharp"
import { Response } from "express"
import { jsPDF } from "jspdf"
import { asyncHandler } from "../utils/asyncHandler"
import { AuthenticatedRequest } from "../middleware/auth"
import { ApiError } from "../utils/ApiError"
import { SiteEvaluation } from "../models/SiteEvaluation"
import { Proposal } from "../models/Proposal"
import { Site } from "../models/Site"
import { Farm } from "../models/Farm"
import { createNotification } from "./notificationController"
import { getInfrastructureMap } from "../services/infrastructureConfigService"
 
const REPORT_TYPES = [
  "site_evaluation",
  "infrastructure_proposal",
  "cost_estimate",
  "sales_pipeline",
  "site_comparison",
  "executive_summary",
] as const

function getReportsDir(): string {
  return path.resolve(path.join(__dirname, "..", "..", "public", "reports"))
}

/**
 * Single-segment basename only, no path traversal; must end with an allowed extension.
 */
function resolveSafeReportFile(
  rawParam: string | undefined,
  allowedLowerExtensions: readonly string[]
): { absPath: string; baseName: string } {
  if (!rawParam || typeof rawParam !== "string") {
    throw new ApiError(400, "fileName is required")
  }
  let decoded: string
  try {
    decoded = decodeURIComponent(rawParam)
  } catch {
    decoded = rawParam
  }
  if (decoded.includes("\0")) {
    throw new ApiError(400, "Invalid file name")
  }
  if (decoded.includes("/") || decoded.includes("\\") || decoded.includes("..")) {
    throw new ApiError(400, "Invalid file name")
  }
  const baseName = path.basename(decoded)
  if (baseName !== decoded) {
    throw new ApiError(400, "Invalid file name")
  }
  const low = baseName.toLowerCase()
  if (!allowedLowerExtensions.some((ext) => low.endsWith(`.${ext}`))) {
    throw new ApiError(400, "Invalid file type")
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(baseName)) {
    throw new ApiError(400, "Invalid file name")
  }
  const absDir = getReportsDir()
  const absPath = path.resolve(absDir, baseName)
  const dirWithSep = absDir.endsWith(path.sep) ? absDir : `${absDir}${path.sep}`
  if (absPath !== absDir && !absPath.startsWith(dirWithSep)) {
    throw new ApiError(400, "Invalid path")
  }
  return { absPath, baseName }
}
 
function fetchMapboxStaticOnce(url: string): Promise<Buffer | null> {
  return new Promise<Buffer | null>((resolve) => {
    const https = require("https")
    const req = https.get(url, { timeout: 15000 }, (res: any) => {
      if (res.statusCode !== 200) {
        console.warn("Mapbox static API returned status:", res.statusCode)
        resolve(null)
        return
      }
      const chunks: Buffer[] = []
      res.on("data", (c: Buffer) => chunks.push(c))
      res.on("end", () => resolve(Buffer.concat(chunks)))
      res.on("error", () => resolve(null))
    })
    req.on("error", (e: Error) => {
      console.warn("Mapbox request error:", e.message)
      resolve(null)
    })
    req.on("timeout", () => {
      req.destroy()
      resolve(null)
    })
  })
}

async function getMapboxImage(geojson: any): Promise<string | null> {
  const token = process.env.MAPBOX_TOKEN?.trim()
  if (!token) {
    console.warn("[getMapboxImage] MAPBOX_TOKEN is not set — skipping satellite snapshot")
    return null
  }
  try {
    const coords = geojson?.coordinates?.[0]
    if (!coords || coords.length < 3) return null

    const lats = coords.map((c: number[]) => c[1])
    const lngs = coords.map((c: number[]) => c[0])
    const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2
    const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2

    const overlay = encodeURIComponent(
      JSON.stringify({
        type: "Feature",
        properties: {
          stroke: "#ec4899",
          "stroke-width": 3,
          fill: "#ec4899",
          "fill-opacity": 0.25,
        },
        geometry: geojson,
      })
    )

    const url = `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/geojson(${overlay})/${centerLng},${centerLat},16,0/800x500?access_token=${token}`

    let buffer = await fetchMapboxStaticOnce(url)
    if (!buffer) {
      console.warn("[getMapboxImage] First Mapbox fetch failed, retrying once…")
      buffer = await fetchMapboxStaticOnce(url)
    }
    if (!buffer) return null
    return buffer.toString("base64")
  } catch (e: any) {
    console.error("getMapboxImage error:", e?.message ?? e)
    return null
  }
}

// ── Farm evaluation proforma PDF (reportType: site_evaluation) ─────────────

const GST_PERCENT = 0.18
const DEFAULT_CONTINGENCY_PERCENT = 0.05
const FARM_EVAL_RGB_TABLE_HEADER: [number, number, number] = [243, 244, 246]
const FARM_EVAL_RGB_TABLE_ZEBRA: [number, number, number] = [248, 250, 252]
const FARM_EVAL_RGB_DIVIDER: [number, number, number] = [229, 231, 235]
const FARM_EVAL_RGB_TEXT_PRIMARY: [number, number, number] = [31, 41, 55]
const FARM_EVAL_RGB_TEXT_BODY: [number, number, number] = [31, 41, 55]
const FARM_EVAL_RGB_TEXT_MUTED: [number, number, number] = [107, 114, 128]
const FARM_EVAL_RGB_TEXT_LABEL: [number, number, number] = [107, 114, 128]
const FARM_EVAL_RGB_HEADER_META: [number, number, number] = [107, 114, 128]
const FARM_EVAL_RGB_WATERMARK: [number, number, number] = [244, 246, 244]
const FARM_EVAL_RGB_PLACEHOLDER_BG: [number, number, number] = [240, 240, 240]
const FARM_EVAL_RGB_PLACEHOLDER_TEXT: [number, number, number] = [120, 120, 120]
const FARM_EVAL_FONT_SECTION = 10.5
const FARM_EVAL_FONT_BODY = 10
const FARM_EVAL_FONT_CAPTION = 8.5
const FARM_EVAL_FONT_HEADER_BAR_TITLE = 14
const FARM_EVAL_FONT_WATERMARK = 36
const FARM_EVAL_GAP_SECTION = 7
const FARM_EVAL_GAP_LINE = 4.25
const FARM_EVAL_MARGIN_X = 14
const FARM_EVAL_Y_MAX_CONTENT = 266
const FARM_EVAL_ROW_PAIR_MM = 11
const FARM_EVAL_SECTION_TITLE_RULE_MM = 8

const FARM_EVAL_WATERMARK_TEXT = "CONFIDENTIAL"
const FARM_EVAL_FONT_DEJAVU = "FarmEvalDejaVu"
const FARM_EVAL_FONT_INTER = "FarmEvalInter"
/** ~50 CSS px height at 96dpi → mm */
const FARM_EVAL_LOGO_MAX_HEIGHT_MM = (50 / 96) * 25.4
const FARM_EVAL_MAP_MAX_BYTES_BEFORE_COMPRESS = 320_000
const ESTIMATE_VALIDITY_DAYS = 30

/**
 * Indian currency for PDF: U+20B9 when embedded font supports it; otherwise "Rs." (Helvetica maps ₹ poorly).
 */
function fmtInrPdf(n: number, useUnicodeRupee = true): string {
  if (!Number.isFinite(n) || n < 0) return "—"
  const num = Math.round(n).toLocaleString("en-IN")
  if (useUnicodeRupee) return `\u20B9\u00A0${num}`
  return `Rs.\u00A0${num}`
}

function resolveFarmEvalDejaVuPath(fileName: string): string | null {
  const roots = [
    path.join(process.cwd(), "node_modules", "dejavu-fonts-ttf", "ttf"),
    path.join(process.cwd(), "backend", "node_modules", "dejavu-fonts-ttf", "ttf"),
    path.join(__dirname, "..", "..", "node_modules", "dejavu-fonts-ttf", "ttf"),
  ]
  for (const root of roots) {
    const p = path.join(root, fileName)
    if (fs.existsSync(p)) return p
  }
  return null
}

function farmEvalRegisterDejaVu(doc: InstanceType<typeof jsPDF>): { ok: boolean; hasItalic: boolean } {
  const normalPath = resolveFarmEvalDejaVuPath("DejaVuSans.ttf")
  const boldPath = resolveFarmEvalDejaVuPath("DejaVuSans-Bold.ttf")
  const obliquePath = resolveFarmEvalDejaVuPath("DejaVuSans-Oblique.ttf")
  if (!normalPath || !boldPath) return { ok: false, hasItalic: false }
  try {
    doc.addFileToVFS("fe-dejavu-n.ttf", fs.readFileSync(normalPath).toString("binary"))
    doc.addFont("fe-dejavu-n.ttf", FARM_EVAL_FONT_DEJAVU, "normal")
    doc.addFileToVFS("fe-dejavu-b.ttf", fs.readFileSync(boldPath).toString("binary"))
    doc.addFont("fe-dejavu-b.ttf", FARM_EVAL_FONT_DEJAVU, "bold")
    let hasItalic = false
    if (obliquePath) {
      doc.addFileToVFS("fe-dejavu-i.ttf", fs.readFileSync(obliquePath).toString("binary"))
      doc.addFont("fe-dejavu-i.ttf", FARM_EVAL_FONT_DEJAVU, "italic")
      hasItalic = true
    }
    return { ok: true, hasItalic }
  } catch (e) {
    console.warn("[farmEvalPDF] DejaVu font registration failed:", (e as Error)?.message)
    return { ok: false, hasItalic: false }
  }
}

function readPngIhdrDimensions(buf: Buffer): { w: number; h: number } | null {
  if (buf.length < 24 || buf[0] !== 0x89) return null
  if (buf.toString("ascii", 12, 16) !== "IHDR") return null
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) }
}

/**
 * Draw logo at fixed height (object-fit: contain) — width follows intrinsic aspect ratio (no stretch).
 */
function tryAddGrowteqLogoPngFit(
  doc: InstanceType<typeof jsPDF>,
  x: number,
  y: number,
  maxHeightMm: number
): { drawn: boolean; widthMm: number; heightMm: number } {
  const logoCandidates = [
    path.join(process.cwd(), "backend", "backend", "public", "images", "growteq-logo.png"),
    path.join(process.cwd(), "backend", "public", "images", "growteq-logo.png"),
    path.join(process.cwd(), "public", "images", "growteq-logo.png"),
    path.join(__dirname, "..", "..", "public", "images", "growteq-logo.png"),
    path.join(__dirname, "..", "..", "..", "public", "images", "growteq-logo.png"),
  ]
  for (const logoPath of logoCandidates) {
    if (!fs.existsSync(logoPath)) continue
    try {
      const fileBuf = fs.readFileSync(logoPath)
      const dim = readPngIhdrDimensions(fileBuf)
      const logoH = maxHeightMm
      const logoW = dim && dim.h > 0 ? (maxHeightMm * dim.w) / dim.h : maxHeightMm * 2.1
      const logoBase64 = fileBuf.toString("base64")
      doc.addImage(`data:image/png;base64,${logoBase64}`, "PNG", x, y, logoW, logoH)
      return { drawn: true, widthMm: logoW, heightMm: logoH }
    } catch {
      /* try next path */
    }
  }
  return { drawn: false, widthMm: 0, heightMm: 0 }
}

function resolveFarmEvalInterTtfPaths(): { roman: string | null; italic: string | null } {
  const interRel = ["node_modules", "typeface-inter", "Inter Variable", "Single axis"]
  const roots = [
    path.join(process.cwd(), ...interRel),
    path.join(process.cwd(), "backend", ...interRel),
    path.join(__dirname, "..", "..", ...interRel),
  ]
  for (const root of roots) {
    const roman = path.join(root, "Inter-roman.ttf")
    const italic = path.join(root, "Inter-italic.ttf")
    if (fs.existsSync(roman)) {
      return { roman, italic: fs.existsSync(italic) ? italic : null }
    }
  }
  return { roman: null, italic: null }
}

function farmEvalRegisterInter(doc: InstanceType<typeof jsPDF>): { ok: boolean; hasItalic: boolean } {
  const { roman, italic } = resolveFarmEvalInterTtfPaths()
  if (!roman) return { ok: false, hasItalic: false }
  try {
    doc.addFileToVFS("fe-inter-r.ttf", fs.readFileSync(roman).toString("binary"))
    doc.addFont("fe-inter-r.ttf", FARM_EVAL_FONT_INTER, "normal")
    doc.addFont("fe-inter-r.ttf", FARM_EVAL_FONT_INTER, "bold")
    let hasItalic = false
    if (italic) {
      doc.addFileToVFS("fe-inter-i.ttf", fs.readFileSync(italic).toString("binary"))
      doc.addFont("fe-inter-i.ttf", FARM_EVAL_FONT_INTER, "italic")
      hasItalic = true
    }
    return { ok: true, hasItalic }
  } catch (e) {
    console.warn("[farmEvalPDF] Inter font registration failed:", (e as Error)?.message)
    return { ok: false, hasItalic: false }
  }
}

/** Downscale large Mapbox PNGs to limit memory / PDF size; returns JPEG when compressed. */
async function farmEvalPrepareMapImage(
  mapBase64: string | null
): Promise<{ base64: string | null; imageKind: "PNG" | "JPEG" }> {
  if (mapBase64 == null || typeof mapBase64 !== "string" || !mapBase64.trim()) {
    return { base64: null, imageKind: "PNG" }
  }
  const trimmed = mapBase64.trim()
  try {
    const buf = Buffer.from(trimmed, "base64")
    if (!buf.length) return { base64: null, imageKind: "PNG" }
    if (buf.length <= FARM_EVAL_MAP_MAX_BYTES_BEFORE_COMPRESS) {
      return { base64: trimmed, imageKind: "PNG" }
    }
    const out = await sharp(buf)
      .resize({ width: 960, height: 640, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer()
    return { base64: out.toString("base64"), imageKind: "JPEG" }
  } catch (e) {
    console.warn("[farmEvalPDF] map optimize failed, using original:", (e as Error)?.message)
    return { base64: trimmed, imageKind: "PNG" }
  }
}

function resolveFarmEvalInfraKey(prop: any | null, ev: any): string {
  const raw = (prop?.infrastructureType || ev?.infrastructureRecommendation || "open_field") as string
  return String(raw).toLowerCase().replace(/\s+/g, "_")
}

function boundaryCompactnessRatio(areaAc: number, perimeterM: number): number | null {
  if (!Number.isFinite(areaAc) || !Number.isFinite(perimeterM) || areaAc <= 0 || perimeterM <= 0) return null
  const areaM2 = areaAc * 4046.8564224
  return (4 * Math.PI * areaM2) / (perimeterM * perimeterM)
}

interface CostTableRowPdf {
  component: string
  description: string
  qty: string
  unitCost: number
  lineTotal: number
}

function buildFarmEvalCostRows(
  areaAc: number,
  prop: any | null,
  infraKey: string
): { rows: CostTableRowPdf[]; subtotal: number } {
  const inv = prop?.investmentValue != null ? Number(prop.investmentValue) : 0
  const safeArea = Number.isFinite(areaAc) && areaAc > 0 ? areaAc : 1
  const qtyAcres = `${safeArea.toFixed(2)} acres`
  const qtyLot = "1 lot (unit)"

  const polyhouseSplits: { component: string; description: string; pct: number; qtyMode: "area" | "lot" }[] = [
    { component: "Polyhouse setup", description: "Framework, cladding & anchoring", pct: 0.68, qtyMode: "area" },
    { component: "Drip irrigation system", description: "Mainline, laterals, filters & emitters", pct: 0.12, qtyMode: "area" },
    { component: "Water storage tank", description: "Reservoir with inlet works", pct: 0.08, qtyMode: "lot" },
    { component: "Pump system", description: "Pump, piping & electricals", pct: 0.07, qtyMode: "lot" },
    { component: "Land preparation", description: "Levelling, bunding, soil conditioning", pct: 0.03, qtyMode: "area" },
    { component: "Sensors / IoT (optional)", description: "Monitoring kit", pct: 0.02, qtyMode: "lot" },
  ]
  const shadeSplits: { component: string; description: string; pct: number; qtyMode: "area" | "lot" }[] = [
    { component: "Shade net structure", description: "Columns, cables & shade fabric", pct: 0.62, qtyMode: "area" },
    { component: "Drip / sprinkler irrigation", description: "Distribution network", pct: 0.18, qtyMode: "area" },
    { component: "Water storage tank", description: "Storage & feed arrangement", pct: 0.1, qtyMode: "lot" },
    { component: "Pump system", description: "Pump set & controls", pct: 0.06, qtyMode: "lot" },
    { component: "Land preparation", description: "Field shaping & drainage basics", pct: 0.03, qtyMode: "area" },
    { component: "Sensors / IoT (optional)", description: "Field monitoring", pct: 0.01, qtyMode: "lot" },
  ]
  const openSplits: { component: string; description: string; pct: number; qtyMode: "area" | "lot" }[] = [
    { component: "Land preparation", description: "Ploughing, bunding & layout", pct: 0.35, qtyMode: "area" },
    { component: "Drip irrigation system", description: "Laterals & emitters", pct: 0.28, qtyMode: "area" },
    { component: "Water storage tank", description: "Farm reservoir", pct: 0.12, qtyMode: "lot" },
    { component: "Pump system", description: "Irrigation pump & panels", pct: 0.1, qtyMode: "lot" },
    { component: "Fencing & access", description: "Perimeter fence & access", pct: 0.1, qtyMode: "area" },
    { component: "Sensors / IoT (optional)", description: "Telemetry", pct: 0.05, qtyMode: "lot" },
  ]

  let template = openSplits
  if (infraKey.includes("poly")) template = polyhouseSplits
  else if (infraKey.includes("shade")) template = shadeSplits

  const mapRow = (t: (typeof template)[0], lineTotal: number): CostTableRowPdf => {
    if (t.qtyMode === "area") {
      const unitCost = lineTotal / safeArea
      return { component: t.component, description: t.description, qty: qtyAcres, unitCost, lineTotal }
    }
    return { component: t.component, description: t.description, qty: qtyLot, unitCost: lineTotal, lineTotal }
  }

  if (inv > 0) {
    const rows = template.map((t) => mapRow(t, Math.round(inv * t.pct)))
    const subtotal = rows.reduce((s, r) => s + r.lineTotal, 0)
    return { rows, subtotal }
  }

  const perAcre = infraKey.includes("poly") ? 920000 : infraKey.includes("shade") ? 480000 : 145000
  const subtotalBase = Math.round(safeArea * perAcre)
  const rows: CostTableRowPdf[] = template.map((t) => {
    const lineTotal = Math.round(subtotalBase * t.pct)
    const base = mapRow(t, lineTotal)
    return { ...base, description: `${base.description} (indicative)` }
  })
  const subtotal = rows.reduce((s, r) => s + r.lineTotal, 0)
  return { rows, subtotal }
}

interface FarmEvalPDFData {
  siteName: string
  farmName: string
  locationStr: string
  /** Customer / client-facing row (falls back to N/A when not on record) */
  customerName: string
  customerPhone: string
  customerLocation: string
  infraHint: string
  soilRecorded?: string
  waterRecorded?: string
  cropRecorded?: string
  sunRecorded?: string
  costRows: CostTableRowPdf[]
  costSubtotal: number
  gstAmount: number
  contingencyAmount: number
  grandTotalCost: number
  contingencyPctLabel: string
  reportId: string
  reportTitle: string
  reportSubtitle: string
  areaAcresLabel: string
  perimeterMetersLabel: string
  slopePctLabel: string
  terrainLabel: string
  statusLabel: string
  evaluationDateStr: string
  infraTypeDisplay: string
  infraDescription: string
  suitabilityLabel: string
  setupTimeLabel: string
  mapBase64: string | null
  boundaryCompactnessRatio: number | null
  notesText: string | null
  roiMonthsLabel: string
  totalInvestmentAmount: number
  expectedReturnAmount: number
  profitMarginLabel: string
  isProposalBackedCosts: boolean
  executiveSummaryLines: string[]
  implementationPlanLines: string[]
  hasProposal: boolean
  coverIssueDateDisplay: string
  mapImageKind: "PNG" | "JPEG"
  expectedYieldLabel: string
  paybackPeriodLabel: string
  profitabilityInsightParagraph: string
}

interface FarmEvalPdfCtx {
  y: number
  pageW: number
  /** Embedded body font (Inter or DejaVu), or null → Helvetica */
  customFont: string | null
  hasItalic: boolean
  useUnicodeRupee: boolean
}

type FarmEvalFontStyle = "normal" | "bold" | "italic"
function farmEvalSetFont(
  doc: InstanceType<typeof jsPDF>,
  ctx: FarmEvalPdfCtx,
  style: FarmEvalFontStyle
): void {
  if (ctx.customFont) {
    if (style === "bold") doc.setFont(ctx.customFont, "bold")
    else if (style === "italic" && ctx.hasItalic) doc.setFont(ctx.customFont, "italic")
    else doc.setFont(ctx.customFont, "normal")
  } else {
    doc.setFont("helvetica", style)
  }
}

function farmEvalEnsureSpace(doc: InstanceType<typeof jsPDF>, ctx: FarmEvalPdfCtx, needBelow: number): void {
  if (ctx.y + needBelow > FARM_EVAL_Y_MAX_CONTENT) {
    doc.addPage()
    ctx.y = 20
  }
}

function farmEvalEndSection(doc: InstanceType<typeof jsPDF>, ctx: FarmEvalPdfCtx): void {
  doc.setDrawColor(...FARM_EVAL_RGB_DIVIDER)
  doc.setLineWidth(0.2)
  doc.line(FARM_EVAL_MARGIN_X, ctx.y, ctx.pageW - FARM_EVAL_MARGIN_X, ctx.y)
  ctx.y += FARM_EVAL_GAP_SECTION
}

function farmEvalDrawSectionHeading(doc: InstanceType<typeof jsPDF>, ctx: FarmEvalPdfCtx, title: string): void {
  ctx.y += 1.5
  farmEvalEnsureSpace(doc, ctx, FARM_EVAL_SECTION_TITLE_RULE_MM + FARM_EVAL_GAP_SECTION + 6)
  const { pageW } = ctx
  const top = ctx.y
  farmEvalSetFont(doc, ctx, "bold")
  doc.setFontSize(FARM_EVAL_FONT_SECTION)
  doc.setTextColor(...FARM_EVAL_RGB_TEXT_PRIMARY)
  doc.text(title, FARM_EVAL_MARGIN_X, top + 5)
  doc.setDrawColor(...FARM_EVAL_RGB_DIVIDER)
  doc.setLineWidth(0.2)
  doc.line(
    FARM_EVAL_MARGIN_X,
    top + FARM_EVAL_SECTION_TITLE_RULE_MM,
    pageW - FARM_EVAL_MARGIN_X,
    top + FARM_EVAL_SECTION_TITLE_RULE_MM
  )
  ctx.y = top + FARM_EVAL_SECTION_TITLE_RULE_MM + FARM_EVAL_GAP_SECTION + 1
}

const FARM_EVAL_MAP_CAPTION = "Satellite View with Site Boundary"
const FARM_EVAL_ROI_VALUE_UNAVAILABLE =
  "Data currently unavailable. Estimates depend on crop selection and yield conditions."

function farmEvalFormatRoiMetricValue(raw: string): string {
  const t = raw.trim()
  if (t === "Data not available" || t === "N/A") return FARM_EVAL_ROI_VALUE_UNAVAILABLE
  return raw
}

function farmEvalDrawProformaHeader(
  doc: InstanceType<typeof jsPDF>,
  ctx: FarmEvalPdfCtx,
  d: FarmEvalPDFData
): void {
  const { pageW } = ctx
  const top = 11
  const logo = tryAddGrowteqLogoPngFit(doc, FARM_EVAL_MARGIN_X, top, FARM_EVAL_LOGO_MAX_HEIGHT_MM)
  const titleBlockLeft = logo.drawn ? FARM_EVAL_MARGIN_X + logo.widthMm + 5 : FARM_EVAL_MARGIN_X
  const headerRowH = Math.max(logo.drawn ? logo.heightMm : 0, 14)
  const titleBaseline = top + headerRowH * 0.55
  farmEvalSetFont(doc, ctx, "bold")
  doc.setFontSize(FARM_EVAL_FONT_HEADER_BAR_TITLE)
  doc.setTextColor(...FARM_EVAL_RGB_TEXT_PRIMARY)
  doc.text("Farm Evaluation Report", titleBlockLeft, titleBaseline)
  if (!logo.drawn) {
    farmEvalSetFont(doc, ctx, "normal")
    doc.setFontSize(FARM_EVAL_FONT_CAPTION)
    doc.setTextColor(...FARM_EVAL_RGB_TEXT_MUTED)
    doc.text("Growteq Agri Farms Pvt Ltd", titleBlockLeft, titleBaseline + 5)
  }
  const issueDate = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  })
  farmEvalSetFont(doc, ctx, "normal")
  doc.setFontSize(FARM_EVAL_FONT_CAPTION)
  doc.setTextColor(...FARM_EVAL_RGB_TEXT_MUTED)
  const metaTop = top + 1.5
  doc.text(`Report ID: ${d.reportId}`, pageW - FARM_EVAL_MARGIN_X, metaTop, { align: "right" })
  doc.text(issueDate, pageW - FARM_EVAL_MARGIN_X, metaTop + 5, { align: "right" })
  const ruleY = top + headerRowH + 4
  doc.setDrawColor(...FARM_EVAL_RGB_DIVIDER)
  doc.setLineWidth(0.2)
  doc.line(FARM_EVAL_MARGIN_X, ruleY, pageW - FARM_EVAL_MARGIN_X, ruleY)
  ctx.y = ruleY + 6
}

function farmEvalPdfFieldNA(v: unknown): string {
  if (v == null) return "N/A"
  const s = String(v).trim()
  return s.length > 0 ? s : "N/A"
}

function renderFarmEvalCustomerDetails(
  doc: InstanceType<typeof jsPDF>,
  d: FarmEvalPDFData,
  ctx: FarmEvalPdfCtx
): void {
  farmEvalDrawSectionHeading(doc, ctx, "Customer details")
  const midX = ctx.pageW / 2
  const gapMm = 8 / 2.834
  const rows: [string, string][] = [
    ["Name", d.customerName],
    ["Mobile", d.customerPhone],
    ["Location", d.customerLocation],
  ]
  for (let i = 0; i < rows.length; i += 2) {
    farmEvalEnsureSpace(doc, ctx, FARM_EVAL_ROW_PAIR_MM + gapMm)
    const left = rows[i]
    const right = rows[i + 1]
    if (left) {
      doc.setFontSize(FARM_EVAL_FONT_BODY)
      farmEvalSetFont(doc, ctx, "normal")
      doc.setTextColor(...FARM_EVAL_RGB_TEXT_LABEL)
      doc.text(left[0], FARM_EVAL_MARGIN_X, ctx.y)
      farmEvalSetFont(doc, ctx, "bold")
      doc.setTextColor(...FARM_EVAL_RGB_TEXT_PRIMARY)
      doc.text(left[1], FARM_EVAL_MARGIN_X, ctx.y + FARM_EVAL_GAP_LINE + 0.5)
    }
    if (right) {
      doc.setFontSize(FARM_EVAL_FONT_BODY)
      farmEvalSetFont(doc, ctx, "normal")
      doc.setTextColor(...FARM_EVAL_RGB_TEXT_LABEL)
      doc.text(right[0], midX + gapMm / 2, ctx.y)
      farmEvalSetFont(doc, ctx, "bold")
      doc.setTextColor(...FARM_EVAL_RGB_TEXT_PRIMARY)
      doc.text(right[1], midX + gapMm / 2, ctx.y + FARM_EVAL_GAP_LINE + 0.5)
    }
    ctx.y += FARM_EVAL_ROW_PAIR_MM + gapMm
  }
  farmEvalEndSection(doc, ctx)
}

/** Watermark + footer on all pages. Call after all content is written. */
function farmEvalApplyWatermarkAndFooters(
  doc: InstanceType<typeof jsPDF>,
  reportId: string,
  opts: { footerFont: string | null }
): void {
  const pageW = 210
  const total = doc.getNumberOfPages()
  const bodyPages = Math.max(1, total)
  for (let p = 1; p <= total; p++) {
    doc.setPage(p)
    doc.saveGraphicsState()
    doc.setTextColor(...FARM_EVAL_RGB_WATERMARK)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(FARM_EVAL_FONT_WATERMARK)
    doc.text(FARM_EVAL_WATERMARK_TEXT, pageW / 2, 152, { align: "center", angle: 40 })
    doc.restoreGraphicsState()
    const ruleY = 275
    const footerTextY = 284
    doc.setDrawColor(...FARM_EVAL_RGB_DIVIDER)
    doc.setLineWidth(0.15)
    doc.line(FARM_EVAL_MARGIN_X, ruleY, pageW - FARM_EVAL_MARGIN_X, ruleY)
    if (opts.footerFont) doc.setFont(opts.footerFont, "normal")
    else doc.setFont("helvetica", "normal")
    doc.setFontSize(8.5)
    doc.setTextColor(...FARM_EVAL_RGB_TEXT_MUTED)
    doc.text("Growteq Agri Farms Pvt Ltd", FARM_EVAL_MARGIN_X, footerTextY)
    doc.text(reportId, pageW / 2, footerTextY, { align: "center" })
    doc.text(`Page ${p} of ${bodyPages}`, pageW - FARM_EVAL_MARGIN_X, footerTextY, { align: "right" })
  }
}

function renderFarmEvalExecutiveSummary(
  doc: InstanceType<typeof jsPDF>,
  d: FarmEvalPDFData,
  ctx: FarmEvalPdfCtx
): void {
  farmEvalDrawSectionHeading(doc, ctx, "Executive summary")
  const lines = d.executiveSummaryLines.length > 0 ? d.executiveSummaryLines : ["—"]
  farmEvalSetFont(doc, ctx, "normal")
  doc.setFontSize(FARM_EVAL_FONT_BODY)
  doc.setTextColor(...FARM_EVAL_RGB_TEXT_BODY)
  for (const line of lines) {
    farmEvalEnsureSpace(doc, ctx, FARM_EVAL_GAP_LINE * 4)
    const wrapped = doc.splitTextToSize(`\u2022 ${line}`, ctx.pageW - 2 * FARM_EVAL_MARGIN_X - 3)
    doc.text(wrapped, FARM_EVAL_MARGIN_X + 2, ctx.y)
    ctx.y += wrapped.length * FARM_EVAL_GAP_LINE + 1
  }
  farmEvalEndSection(doc, ctx)
}

function renderFarmEvalFarmDetails(doc: InstanceType<typeof jsPDF>, d: FarmEvalPDFData, ctx: FarmEvalPdfCtx): void {
  farmEvalDrawSectionHeading(doc, ctx, "Site details")
  const midX = ctx.pageW / 2
  const leftCol: [string, string][] = [
    ["Farm name", (d.farmName || "—").trim() || "—"],
    ["Site name", (d.siteName || "—").trim() || "—"],
    ["Location", (d.locationStr || "—").trim() || "—"],
    ["Status", (d.statusLabel || "—").trim() || "—"],
  ]
  const rightCol: [string, string][] = [
    ["Area", (d.areaAcresLabel || "—").trim() || "—"],
    ["Perimeter", (d.perimeterMetersLabel || "—").trim() || "—"],
    ["Slope", (d.slopePctLabel || "—").trim() || "—"],
    ["Terrain", (d.terrainLabel || "—").trim() || "—"],
  ]
  const maxRows = Math.max(leftCol.length, rightCol.length)
  for (let i = 0; i < maxRows; i++) {
    farmEvalEnsureSpace(doc, ctx, FARM_EVAL_ROW_PAIR_MM + 4)
    const left = leftCol[i]
    const right = rightCol[i]
    if (left) {
      doc.setFontSize(FARM_EVAL_FONT_BODY)
      farmEvalSetFont(doc, ctx, "normal")
      doc.setTextColor(...FARM_EVAL_RGB_TEXT_LABEL)
      doc.text(left[0], FARM_EVAL_MARGIN_X, ctx.y)
      farmEvalSetFont(doc, ctx, "bold")
      doc.setTextColor(...FARM_EVAL_RGB_TEXT_PRIMARY)
      doc.text(left[1], FARM_EVAL_MARGIN_X, ctx.y + FARM_EVAL_GAP_LINE + 1)
    }
    if (right) {
      doc.setFontSize(FARM_EVAL_FONT_BODY)
      farmEvalSetFont(doc, ctx, "normal")
      doc.setTextColor(...FARM_EVAL_RGB_TEXT_LABEL)
      doc.text(right[0], midX + 4, ctx.y)
      farmEvalSetFont(doc, ctx, "bold")
      doc.setTextColor(...FARM_EVAL_RGB_TEXT_PRIMARY)
      doc.text(right[1], midX + 4, ctx.y + FARM_EVAL_GAP_LINE + 1)
    }
    ctx.y += FARM_EVAL_ROW_PAIR_MM + FARM_EVAL_GAP_LINE
  }
  farmEvalEndSection(doc, ctx)
}

function renderFarmEvalBoundaryAnalysis(
  doc: InstanceType<typeof jsPDF>,
  d: FarmEvalPDFData,
  ctx: FarmEvalPdfCtx
): void {
  farmEvalDrawSectionHeading(doc, ctx, "Boundary analysis")
  const ratioStr =
    d.boundaryCompactnessRatio != null && Number.isFinite(d.boundaryCompactnessRatio)
      ? d.boundaryCompactnessRatio.toFixed(3)
      : "—"
  const rows: [string, string][] = [
    ["Area", (d.areaAcresLabel || "—").trim() || "—"],
    ["Perimeter", (d.perimeterMetersLabel || "—").trim() || "—"],
    ["Compactness index (4πA/P²)", ratioStr],
  ]
  farmEvalSetFont(doc, ctx, "normal")
  doc.setFontSize(FARM_EVAL_FONT_BODY)
  for (const [k, v] of rows) {
    farmEvalEnsureSpace(doc, ctx, FARM_EVAL_ROW_PAIR_MM + 2)
    doc.setTextColor(...FARM_EVAL_RGB_TEXT_LABEL)
    doc.text(k, FARM_EVAL_MARGIN_X, ctx.y)
    farmEvalSetFont(doc, ctx, "bold")
    doc.setTextColor(...FARM_EVAL_RGB_TEXT_PRIMARY)
    doc.text(v, FARM_EVAL_MARGIN_X, ctx.y + FARM_EVAL_GAP_LINE + 1)
    farmEvalSetFont(doc, ctx, "normal")
    ctx.y += FARM_EVAL_ROW_PAIR_MM + FARM_EVAL_GAP_LINE
  }
  farmEvalEndSection(doc, ctx)
}

function renderFarmEvalEvaluationSummary(
  doc: InstanceType<typeof jsPDF>,
  d: FarmEvalPDFData,
  ctx: FarmEvalPdfCtx
): void {
  farmEvalDrawSectionHeading(doc, ctx, "Evaluation summary")
  const midX = ctx.pageW / 2
  const leftCol: [string, string][] = [
    ["Soil type", d.soilRecorded ?? "N/A"],
    ["Water availability", d.waterRecorded ?? "N/A"],
    ["Sun exposure", d.sunRecorded ?? "N/A"],
  ]
  const rightCol: [string, string][] = [
    ["Slope", d.slopePctLabel],
    ["Crop type", d.cropRecorded ?? "N/A"],
    ["Evaluated on", d.evaluationDateStr],
  ]
  const maxRows = Math.max(leftCol.length, rightCol.length)
  for (let i = 0; i < maxRows; i++) {
    farmEvalEnsureSpace(doc, ctx, FARM_EVAL_ROW_PAIR_MM + 4)
    const left = leftCol[i]
    const right = rightCol[i]
    if (left) {
      doc.setFontSize(FARM_EVAL_FONT_BODY)
      farmEvalSetFont(doc, ctx, "normal")
      doc.setTextColor(...FARM_EVAL_RGB_TEXT_LABEL)
      doc.text(left[0], FARM_EVAL_MARGIN_X, ctx.y)
      farmEvalSetFont(doc, ctx, "bold")
      doc.setTextColor(...FARM_EVAL_RGB_TEXT_PRIMARY)
      doc.text(left[1], FARM_EVAL_MARGIN_X, ctx.y + FARM_EVAL_GAP_LINE + 1)
    }
    if (right) {
      doc.setFontSize(FARM_EVAL_FONT_BODY)
      farmEvalSetFont(doc, ctx, "normal")
      doc.setTextColor(...FARM_EVAL_RGB_TEXT_LABEL)
      doc.text(right[0], midX + 4, ctx.y)
      farmEvalSetFont(doc, ctx, "bold")
      doc.setTextColor(...FARM_EVAL_RGB_TEXT_PRIMARY)
      doc.text(right[1], midX + 4, ctx.y + FARM_EVAL_GAP_LINE + 1)
    }
    ctx.y += FARM_EVAL_ROW_PAIR_MM + FARM_EVAL_GAP_LINE
  }
  farmEvalEndSection(doc, ctx)
}

function renderFarmEvalInfrastructure(
  doc: InstanceType<typeof jsPDF>,
  d: FarmEvalPDFData,
  ctx: FarmEvalPdfCtx
): void {
  farmEvalDrawSectionHeading(doc, ctx, "Recommended infrastructure")
  const midX = ctx.pageW / 2
  const leftCol: [string, string][] = [
    ["Type", d.infraTypeDisplay],
    ["Description", d.infraDescription],
  ]
  const rightCol: [string, string][] = [
    ["Suitability", d.suitabilityLabel],
    ["Est. setup time", d.setupTimeLabel],
  ]
  for (let i = 0; i < 2; i++) {
    farmEvalEnsureSpace(doc, ctx, FARM_EVAL_ROW_PAIR_MM + 8)
    const left = leftCol[i]
    const right = rightCol[i]
    if (left) {
      doc.setFontSize(FARM_EVAL_FONT_BODY)
      farmEvalSetFont(doc, ctx, "normal")
      doc.setTextColor(...FARM_EVAL_RGB_TEXT_LABEL)
      doc.text(left[0], FARM_EVAL_MARGIN_X, ctx.y)
      farmEvalSetFont(doc, ctx, "bold")
      doc.setTextColor(...FARM_EVAL_RGB_TEXT_PRIMARY)
      const descRaw = (left[1] || "—").trim() || "—"
      const descLines = doc.splitTextToSize(descRaw, midX - FARM_EVAL_MARGIN_X - 10)
      doc.text(descLines, FARM_EVAL_MARGIN_X, ctx.y + FARM_EVAL_GAP_LINE + 1)
      const leftH = FARM_EVAL_GAP_LINE + 1 + descLines.length * FARM_EVAL_GAP_LINE
      if (right) {
        farmEvalSetFont(doc, ctx, "normal")
        doc.setTextColor(...FARM_EVAL_RGB_TEXT_LABEL)
        doc.text(right[0], midX + 4, ctx.y)
        farmEvalSetFont(doc, ctx, "bold")
        doc.setTextColor(...FARM_EVAL_RGB_TEXT_PRIMARY)
        doc.text((right[1] || "—").trim() || "—", midX + 4, ctx.y + FARM_EVAL_GAP_LINE + 1)
      }
      ctx.y += Math.max(leftH, FARM_EVAL_ROW_PAIR_MM + FARM_EVAL_GAP_LINE) + FARM_EVAL_GAP_LINE
    }
  }
  farmEvalEndSection(doc, ctx)
}

function renderFarmEvalCostEstimation(
  doc: InstanceType<typeof jsPDF>,
  d: FarmEvalPDFData,
  ctx: FarmEvalPdfCtx
): void {
  const inr = (n: number) => fmtInrPdf(n, ctx.useUnicodeRupee)
  farmEvalDrawSectionHeading(doc, ctx, "Cost estimation")
  if (!d.costRows.length) {
    farmEvalEnsureSpace(doc, ctx, FARM_EVAL_ROW_PAIR_MM)
    farmEvalSetFont(doc, ctx, "normal")
    doc.setFontSize(FARM_EVAL_FONT_BODY)
    doc.setTextColor(...FARM_EVAL_RGB_TEXT_MUTED)
    doc.text("Cost data not available.", FARM_EVAL_MARGIN_X, ctx.y)
    ctx.y += FARM_EVAL_ROW_PAIR_MM
    farmEvalEndSection(doc, ctx)
    return
  }
  const innerL = FARM_EVAL_MARGIN_X
  const innerR = ctx.pageW - FARM_EVAL_MARGIN_X
  const u = innerR - innerL
  const b = [
    innerL,
    innerL + u * 0.22,
    innerL + u * 0.5,
    innerL + u * 0.62,
    innerL + u * 0.79,
    innerR,
  ]
  const xQtyCenter = (b[2] + b[3]) / 2
  const headH = 9
  farmEvalEnsureSpace(doc, ctx, headH + 6)
  const tableTop = ctx.y
  doc.setFillColor(...FARM_EVAL_RGB_TABLE_HEADER)
  doc.rect(innerL, tableTop, u, headH, "F")
  doc.setDrawColor(...FARM_EVAL_RGB_DIVIDER)
  doc.setLineWidth(0.2)
  doc.rect(innerL, tableTop, u, headH, "S")
  for (let vi = 1; vi <= 4; vi++) {
    doc.line(b[vi], tableTop, b[vi], tableTop + headH)
  }
  farmEvalSetFont(doc, ctx, "bold")
  doc.setFontSize(FARM_EVAL_FONT_CAPTION)
  doc.setTextColor(...FARM_EVAL_RGB_TEXT_PRIMARY)
  doc.text("Component", b[0] + 2, tableTop + 6.2)
  doc.text("Description", b[1] + 2, tableTop + 6.2)
  doc.text("Qty", xQtyCenter, tableTop + 6.2, { align: "center" })
  doc.text("Unit cost", b[4] - 2, tableTop + 6.2, { align: "right" })
  doc.text("Total", b[5] - 2, tableTop + 6.2, { align: "right" })
  ctx.y = tableTop + headH
  d.costRows.forEach((row, ri) => {
    farmEvalSetFont(doc, ctx, "normal")
    doc.setFontSize(FARM_EVAL_FONT_CAPTION)
    const wc = b[1] - b[0] - 3
    const wd = b[2] - b[1] - 3
    const compLines = doc.splitTextToSize(row.component, wc).slice(0, 2)
    const descLines = doc.splitTextToSize(row.description, wd).slice(0, 2)
    const n = Math.max(compLines.length, descLines.length, 1)
    const rowH = 5 + n * FARM_EVAL_GAP_LINE + 0.5
    farmEvalEnsureSpace(doc, ctx, rowH + 2)
    const rowTop = ctx.y
    if (ri % 2 === 0) {
      doc.setFillColor(...FARM_EVAL_RGB_TABLE_ZEBRA)
      doc.rect(innerL, rowTop, u, rowH, "F")
    }
    doc.setDrawColor(...FARM_EVAL_RGB_DIVIDER)
    doc.setLineWidth(0.15)
    doc.line(innerL, rowTop + rowH, innerR, rowTop + rowH)
    for (let vi = 1; vi <= 4; vi++) {
      doc.line(b[vi], rowTop, b[vi], rowTop + rowH)
    }
    doc.setTextColor(...FARM_EVAL_RGB_TEXT_BODY)
    const yy = rowTop + 4
    for (let j = 0; j < n; j++) {
      if (compLines[j]) doc.text(compLines[j], b[0] + 1.5, yy + j * FARM_EVAL_GAP_LINE)
      if (descLines[j]) doc.text(descLines[j], b[1] + 1.5, yy + j * FARM_EVAL_GAP_LINE)
    }
    doc.text(row.qty, xQtyCenter, yy, { align: "center" })
    doc.text(inr(row.unitCost), b[4] - 1.5, yy, { align: "right" })
    doc.text(inr(row.lineTotal), b[5] - 1.5, yy, { align: "right" })
    ctx.y = rowTop + rowH
  })
  const tableBottom = ctx.y
  doc.setLineWidth(0.2)
  doc.line(innerL, tableTop, innerL, tableBottom)
  doc.line(innerR, tableTop, innerR, tableBottom)
  doc.line(innerL, tableBottom, innerR, tableBottom)

  const summaryRows: [string, string][] = [
    ["Subtotal", inr(d.costSubtotal)],
    [`GST (${Math.round(GST_PERCENT * 100)}%)`, inr(d.gstAmount)],
    [`Contingency (${d.contingencyPctLabel})`, inr(d.contingencyAmount)],
    ["Grand total", inr(d.grandTotalCost)],
  ]
  ctx.y += 3
  for (const [label, val] of summaryRows) {
    farmEvalEnsureSpace(doc, ctx, 9)
    doc.setFillColor(...FARM_EVAL_RGB_TABLE_HEADER)
    doc.rect(innerL, ctx.y, u, 7.5, "F")
    doc.setDrawColor(...FARM_EVAL_RGB_DIVIDER)
    doc.rect(innerL, ctx.y, u, 7.5, "S")
    farmEvalSetFont(doc, ctx, "bold")
    doc.setTextColor(...FARM_EVAL_RGB_TEXT_PRIMARY)
    doc.setFontSize(FARM_EVAL_FONT_CAPTION)
    doc.text(label, innerL + 2, ctx.y + 5)
    doc.text(val, innerR - 2, ctx.y + 5, { align: "right" })
    ctx.y += 8
  }
  if (!d.isProposalBackedCosts) {
    farmEvalEnsureSpace(doc, ctx, FARM_EVAL_GAP_LINE * 3)
    farmEvalSetFont(doc, ctx, "italic")
    doc.setFontSize(FARM_EVAL_FONT_CAPTION)
    doc.setTextColor(...FARM_EVAL_RGB_TEXT_MUTED)
    doc.text("Investment split is indicative (no proposal amount on file).", FARM_EVAL_MARGIN_X, ctx.y)
    ctx.y += FARM_EVAL_GAP_LINE * 2
  }
  farmEvalEnsureSpace(doc, ctx, 24)
  farmEvalSetFont(doc, ctx, "normal")
  doc.setFontSize(FARM_EVAL_FONT_CAPTION)
  doc.setTextColor(...FARM_EVAL_RGB_TEXT_MUTED)
  const validity = doc.splitTextToSize(
    `This estimate is valid for ${ESTIMATE_VALIDITY_DAYS} days from the issue date (${d.coverIssueDateDisplay}).`,
    u - 4
  )
  doc.text(validity, FARM_EVAL_MARGIN_X, ctx.y)
  ctx.y += validity.length * FARM_EVAL_GAP_LINE + FARM_EVAL_GAP_LINE
  doc.text("Assumptions:", FARM_EVAL_MARGIN_X, ctx.y)
  ctx.y += FARM_EVAL_GAP_LINE + 1
  const assumptions = [
    "• Prices are indicative",
    "• Based on standard market rates",
    "• Excludes taxes beyond GST (if applicable)",
  ]
  for (const line of assumptions) {
    doc.text(line, FARM_EVAL_MARGIN_X + 2, ctx.y)
    ctx.y += FARM_EVAL_GAP_LINE + 0.5
  }
  farmEvalEndSection(doc, ctx)
}

function renderFarmEvalImplementationPlan(
  doc: InstanceType<typeof jsPDF>,
  d: FarmEvalPDFData,
  ctx: FarmEvalPdfCtx
): void {
  farmEvalDrawSectionHeading(doc, ctx, "Implementation plan")
  const lines = d.implementationPlanLines.length > 0 ? d.implementationPlanLines : ["—"]
  farmEvalSetFont(doc, ctx, "normal")
  doc.setFontSize(FARM_EVAL_FONT_BODY)
  doc.setTextColor(...FARM_EVAL_RGB_TEXT_BODY)
  for (const line of lines) {
    farmEvalEnsureSpace(doc, ctx, FARM_EVAL_GAP_LINE * 4)
    const wrapped = doc.splitTextToSize(line, ctx.pageW - 2 * FARM_EVAL_MARGIN_X)
    doc.text(wrapped, FARM_EVAL_MARGIN_X, ctx.y)
    ctx.y += wrapped.length * FARM_EVAL_GAP_LINE + FARM_EVAL_GAP_LINE * 0.5
  }
  farmEvalEndSection(doc, ctx)
}

function renderFarmEvalSiteMap(doc: InstanceType<typeof jsPDF>, d: FarmEvalPDFData, ctx: FarmEvalPdfCtx): void {
  if (!d.mapBase64?.trim()) return
  farmEvalDrawSectionHeading(doc, ctx, "Site map")
  ctx.y += 2.5
  const mapW = ctx.pageW - 2 * FARM_EVAL_MARGIN_X
  const mapH = 72
  const mapX = FARM_EVAL_MARGIN_X
  const borderPad = 0.75
  try {
    const mime = d.mapImageKind === "JPEG" ? "jpeg" : "png"
    const imgData = `data:image/${mime};base64,${d.mapBase64.trim()}`
    farmEvalEnsureSpace(doc, ctx, mapH + borderPad * 2 + 16)
    doc.setDrawColor(...FARM_EVAL_RGB_DIVIDER)
    doc.setLineWidth(0.35)
    doc.rect(mapX - borderPad, ctx.y - borderPad, mapW + borderPad * 2, mapH + borderPad * 2, "S")
    doc.addImage(imgData, d.mapImageKind, mapX, ctx.y, mapW, mapH)
    ctx.y += mapH + borderPad * 2 + 3
    farmEvalSetFont(doc, ctx, "normal")
    doc.setFontSize(7.8)
    doc.setTextColor(...FARM_EVAL_RGB_TEXT_MUTED)
    doc.text(FARM_EVAL_MAP_CAPTION, ctx.pageW / 2, ctx.y, { align: "center" })
    ctx.y += FARM_EVAL_GAP_LINE + 1
  } catch (e: unknown) {
    console.error("[farmEvalPDF] map embed error:", e instanceof Error ? e.message : e)
    farmEvalEnsureSpace(doc, ctx, 24)
    doc.setFillColor(...FARM_EVAL_RGB_PLACEHOLDER_BG)
    doc.rect(mapX, ctx.y, mapW, 20, "F")
    farmEvalSetFont(doc, ctx, "normal")
    doc.setFontSize(FARM_EVAL_FONT_CAPTION)
    doc.setTextColor(...FARM_EVAL_RGB_PLACEHOLDER_TEXT)
    doc.text("Map image could not be rendered", ctx.pageW / 2, ctx.y + 12, { align: "center" })
    ctx.y += 24
  }
  farmEvalEndSection(doc, ctx)
}

function renderFarmEvalRoi(doc: InstanceType<typeof jsPDF>, d: FarmEvalPDFData, ctx: FarmEvalPdfCtx): void {
  const inr = (n: number) => fmtInrPdf(n, ctx.useUnicodeRupee)
  farmEvalDrawSectionHeading(doc, ctx, "ROI analysis")
  const invLabel =
    d.totalInvestmentAmount > 0 ? inr(d.totalInvestmentAmount) : "Data not available"
  const retLabel =
    d.totalInvestmentAmount > 0 ? inr(d.expectedReturnAmount) : "Data not available"
  const marginLabel = d.profitMarginLabel || "Data not available"
  const timelineLabel = d.roiMonthsLabel && d.roiMonthsLabel !== "N/A" ? d.roiMonthsLabel : "Data not available"
  const innerL = FARM_EVAL_MARGIN_X
  const innerR = ctx.pageW - FARM_EVAL_MARGIN_X
  const u = innerR - innerL
  const splitX = innerL + u * 0.36
  const labelW = splitX - innerL - 4
  const valueW = innerR - splitX - 5
  const metricRows: [string, string][] = [
    ["Estimated investment", invLabel],
    ["Expected yield", d.expectedYieldLabel || "Data not available"],
    ["Payback period (approx.)", d.paybackPeriodLabel || "Data not available"],
    ["Expected return (115% scenario)", retLabel],
    ["ROI timeline", timelineLabel],
    ["Profit margin (indicative)", marginLabel],
  ]
  const headH = 8
  farmEvalEnsureSpace(doc, ctx, headH + 8)
  const tableTop = ctx.y
  doc.setFillColor(...FARM_EVAL_RGB_TABLE_HEADER)
  doc.rect(innerL, tableTop, u, headH, "F")
  doc.setDrawColor(...FARM_EVAL_RGB_DIVIDER)
  doc.setLineWidth(0.2)
  doc.rect(innerL, tableTop, u, headH, "S")
  doc.line(splitX, tableTop, splitX, tableTop + headH)
  farmEvalSetFont(doc, ctx, "bold")
  doc.setFontSize(FARM_EVAL_FONT_CAPTION)
  doc.setTextColor(...FARM_EVAL_RGB_TEXT_PRIMARY)
  doc.text("Metric", innerL + 2, tableTop + 5.5)
  doc.text("Value", innerR - 2, tableTop + 5.5, { align: "right" })
  ctx.y = tableTop + headH
  doc.setFontSize(FARM_EVAL_FONT_BODY)
  metricRows.forEach(([label, rawVal], ri) => {
    const dispVal = farmEvalFormatRoiMetricValue(rawVal)
    const labLines = doc.splitTextToSize(label, labelW)
    const valLines = doc.splitTextToSize(dispVal, valueW)
    const n = Math.max(labLines.length, valLines.length, 1)
    const rowH = 3.5 + n * FARM_EVAL_GAP_LINE + 1
    farmEvalEnsureSpace(doc, ctx, rowH + 2)
    const rowTop = ctx.y
    if (ri % 2 === 0) {
      doc.setFillColor(...FARM_EVAL_RGB_TABLE_ZEBRA)
      doc.rect(innerL, rowTop, u, rowH, "F")
    }
    doc.setDrawColor(...FARM_EVAL_RGB_DIVIDER)
    doc.setLineWidth(0.15)
    doc.line(innerL, rowTop + rowH, innerR, rowTop + rowH)
    doc.line(splitX, rowTop, splitX, rowTop + rowH)
    farmEvalSetFont(doc, ctx, "normal")
    doc.setTextColor(...FARM_EVAL_RGB_TEXT_LABEL)
    doc.text(labLines, innerL + 2, rowTop + 3.5)
    farmEvalSetFont(doc, ctx, "normal")
    doc.setTextColor(...FARM_EVAL_RGB_TEXT_PRIMARY)
    let vx = rowTop + 3.5
    for (const vl of valLines) {
      doc.text(vl, innerR - 2, vx, { align: "right" })
      vx += FARM_EVAL_GAP_LINE
    }
    ctx.y = rowTop + rowH
  })
  const tableBottom = ctx.y
  doc.setLineWidth(0.2)
  doc.line(innerL, tableTop, innerL, tableBottom)
  doc.line(innerR, tableTop, innerR, tableBottom)
  doc.line(innerL, tableBottom, innerR, tableBottom)

  ctx.y += 3
  farmEvalSetFont(doc, ctx, "normal")
  doc.setFontSize(FARM_EVAL_FONT_BODY)
  doc.setTextColor(...FARM_EVAL_RGB_TEXT_BODY)
  const insightLines = doc.splitTextToSize(
    (d.profitabilityInsightParagraph || "—").trim() || "—",
    ctx.pageW - 2 * FARM_EVAL_MARGIN_X
  )
  farmEvalEnsureSpace(doc, ctx, insightLines.length * FARM_EVAL_GAP_LINE + FARM_EVAL_GAP_SECTION)
  doc.text(insightLines, FARM_EVAL_MARGIN_X, ctx.y)
  ctx.y += insightLines.length * FARM_EVAL_GAP_LINE + FARM_EVAL_GAP_LINE
  farmEvalEndSection(doc, ctx)
}

function renderFarmEvalNotes(doc: InstanceType<typeof jsPDF>, d: FarmEvalPDFData, ctx: FarmEvalPdfCtx): void {
  if (!d.notesText?.trim()) return
  farmEvalDrawSectionHeading(doc, ctx, "Notes")
  farmEvalSetFont(doc, ctx, "normal")
  doc.setFontSize(FARM_EVAL_FONT_BODY)
  doc.setTextColor(...FARM_EVAL_RGB_TEXT_BODY)
  const wrapped = doc.splitTextToSize(d.notesText.trim(), ctx.pageW - 2 * FARM_EVAL_MARGIN_X)
  for (const line of wrapped) {
    farmEvalEnsureSpace(doc, ctx, FARM_EVAL_GAP_LINE + 2)
    doc.text(line, FARM_EVAL_MARGIN_X, ctx.y)
    ctx.y += FARM_EVAL_GAP_LINE + 0.5
  }
  farmEvalEndSection(doc, ctx)
}

async function createFarmEvaluationProformaPDF(
  site: any,
  farm: any | null,
  ev: any,
  prop: any | null,
  mapBase64: string | null,
  reportId: string
): Promise<Buffer> {
  console.log(`[farmEvalPDF] generation started reportId=${reportId}`)
  try {
    const siteDoc = site && typeof site === "object" ? site : {}
    const evDoc = ev && typeof ev === "object" ? ev : {}
    const mapPrepared = await farmEvalPrepareMapImage(mapBase64)
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
    const pageW = 210
    const interReg = farmEvalRegisterInter(doc)
    let customFont: string | null = null
    let hasItalic = false
    let useUnicodeRupee = false
    if (interReg.ok) {
      customFont = FARM_EVAL_FONT_INTER
      hasItalic = interReg.hasItalic
      useUnicodeRupee = true
    } else {
      const dj = farmEvalRegisterDejaVu(doc)
      if (dj.ok) {
        customFont = FARM_EVAL_FONT_DEJAVU
        hasItalic = dj.hasItalic
        useUnicodeRupee = true
      }
    }
    const inr = (n: number) => fmtInrPdf(n, useUnicodeRupee)
    const ctx: FarmEvalPdfCtx = { y: 20, pageW, customFont, hasItalic, useUnicodeRupee }

    const areaAc = Number(siteDoc?.area) || 0
    const perimeterM = Number(siteDoc?.perimeter) || 0
    const slopePct = Number(evDoc?.slopePercentage ?? siteDoc?.slope ?? 2.5)
    const infraHint = resolveFarmEvalInfraKey(prop, evDoc)
    const { rows: costRows, subtotal: costSubtotal } = buildFarmEvalCostRows(areaAc, prop, infraHint)
    const gstAmount = Math.round(costSubtotal * GST_PERCENT)
    const contingencyAmount = Math.round(costSubtotal * DEFAULT_CONTINGENCY_PERCENT)
    const grandTotalCost = costSubtotal + gstAmount + contingencyAmount
    const contingencyPctLabel = `${Math.round(DEFAULT_CONTINGENCY_PERCENT * 100)}%`

    const infraNameRaw = (prop?.infrastructureType || evDoc?.infrastructureRecommendation || "open_field") as string
    const infraKeyForRoi = String(infraNameRaw).toLowerCase().replace(/\s+/g, "_")
    const infraKeyNormalized =
      infraKeyForRoi === "shade_net" || infraKeyForRoi === "shadenet"
        ? "shade_net"
        : infraKeyForRoi === "open_field" || infraKeyForRoi === "openfield"
          ? "open_field"
          : "polyhouse"

    const infraMap = await getInfrastructureMap()
    const snap = evDoc?.infrastructureSnapshot as { roiMonths?: number } | undefined
    const roiMonthsNum =
      snap != null && typeof snap.roiMonths === "number" && Number.isFinite(snap.roiMonths)
        ? snap.roiMonths
        : prop?.roiMonths ?? infraMap[infraKeyNormalized]?.roiMonths
    const roiMonthsLabel = roiMonthsNum != null && Number.isFinite(roiMonthsNum) ? `${roiMonthsNum} months` : "N/A"

    const inv = prop?.investmentValue != null ? Number(prop.investmentValue) : 0
    const isProposalBackedCosts = inv > 0
    const totalInvestmentAmount = inv > 0 ? Math.round(inv) : grandTotalCost
    const expectedReturnAmount = Math.round(totalInvestmentAmount * 1.15)
    const profitMarginLabel = infraKeyNormalized === "polyhouse" ? "37.5%" : "15%"
    const hasProposal = prop != null

    const infraDesc: Record<string, string> = {
      polyhouse: "Polyhouse greenhouse system - Climate controlled farming environment",
      shade_net: "Shade Net structure - Sun protection and UV filtering system",
      open_field: "Open Field cultivation - Traditional farming with minimal infrastructure",
    }
    const setupTimeLabel =
      infraKeyNormalized === "polyhouse" ? "90 days" : infraKeyNormalized === "shade_net" ? "30 days" : "14 days"

    const compactness = boundaryCompactnessRatio(areaAc, perimeterM)
    const terrainLabel = slopePct <= 5 ? "Suitable" : "Moderate"
    const suitabilityLabel = slopePct <= 5 ? "High" : "Medium"
    const statusStr = ((siteDoc as { status?: string })?.status || evDoc?.status || "draft") as string

    let implementationPlanLines: string[] = []
    if (infraKeyNormalized === "polyhouse") {
      implementationPlanLines = [
        "1. Site survey & civil layout (days 1–14)",
        "2. Foundation & column anchoring (days 15–40)",
        "3. Framework, cladding & climate accessories (days 41–75)",
        "4. Irrigation, fertigation & commissioning (days 76–90)",
      ]
    } else if (infraKeyNormalized === "shade_net") {
      implementationPlanLines = [
        "1. Land shaping & drainage (days 1–7)",
        "2. Column grid & cable net (days 8–18)",
        "3. Shade fabric & edge tensioning (days 19–25)",
        "4. Irrigation tie-in & handover (days 26–30)",
      ]
    } else {
      implementationPlanLines = [
        "1. Land preparation & layout (days 1–5)",
        "2. Irrigation mainlines & laterals (days 6–10)",
        "3. Storage, pump & field commissioning (days 11–14)",
      ]
    }

    const coverIssueDateDisplay = new Date().toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    })
    const evalRaw = evDoc?.createdAt ? new Date(evDoc.createdAt) : null
    const evaluationDateStr =
      evalRaw && !Number.isNaN(evalRaw.getTime()) ? evalRaw.toLocaleDateString("en-IN") : "—"

    const propContent = prop?.content as Record<string, unknown> | undefined
    let expectedYieldLabel = "Data not available"
    const yieldRaw = propContent?.expectedYield ?? propContent?.estimatedYield
    if (typeof yieldRaw === "string" && yieldRaw.trim()) expectedYieldLabel = yieldRaw.trim()
    else if (typeof yieldRaw === "number" && Number.isFinite(yieldRaw)) expectedYieldLabel = String(yieldRaw)

    let paybackPeriodLabel = "Data not available"
    if (roiMonthsNum != null && Number.isFinite(roiMonthsNum) && roiMonthsNum > 0) {
      paybackPeriodLabel = `~${Math.round(roiMonthsNum)} months (approx.)`
    }

    let profitabilityInsightParagraph: string
    if (
      hasProposal &&
      inv > 0 &&
      roiMonthsNum != null &&
      Number.isFinite(roiMonthsNum) &&
      roiMonthsNum > 0
    ) {
      profitabilityInsightParagraph = `With a proposal-linked investment of ${inr(totalInvestmentAmount)} and an indicative payback horizon near ${Math.round(roiMonthsNum)} months, returns depend on crop plan, yields, and market prices. Treat all figures as planning estimates, not guarantees.`
    } else if (grandTotalCost > 0) {
      profitabilityInsightParagraph =
        "Indicative capex and returns are shown for orientation only. Validate economics with agronomy, offtake, and a formal proposal before commitment."
    } else {
      profitabilityInsightParagraph =
        "Data not available for a structured profitability narrative. Complete proposal and evaluation inputs to strengthen this section."
    }

    const snapInv = evDoc?.infrastructureSnapshot as { minCost?: number; maxCost?: number } | undefined
    const landSuitLine =
      slopePct <= 5
        ? `Land suitability: ${areaAc.toFixed(2)} acres at ${slopePct}% gradient—terrain is conducive to the recommended infrastructure; overall tract assessed as ${terrainLabel.toLowerCase()} for mechanised cultivation and irrigation layout.`
        : `Land suitability: ${areaAc.toFixed(2)} acres at ${slopePct}% gradient—earthworks and drainage design should be phased; the site remains workable for the proposed system with appropriate grading.`
    const infraLine = `Recommended infrastructure: ${infraNameRaw.replace(/_/g, " ")}—selected for consistency with evaluated soil, water availability, sun exposure, and crop assumptions.`
    let investLine: string
    if (inv > 0) {
      investLine = `Investment outlook: proposal-linked capital of ${inr(totalInvestmentAmount)} (see cost table for GST, contingency, and line-item build-up).`
    } else if (
      snapInv?.minCost != null &&
      snapInv?.maxCost != null &&
      Number.isFinite(snapInv.minCost) &&
      Number.isFinite(snapInv.maxCost)
    ) {
      investLine = `Investment outlook: indicative band from the evaluation snapshot is ${inr(snapInv.minCost)}–${inr(snapInv.maxCost)}; final outturn depends on vendor quotes and site conditions.`
    } else {
      investLine = `Investment outlook: benchmark-based order of magnitude (incl. GST & contingency in the cost section) centres on approximately ${inr(grandTotalCost)} pending formal pricing.`
    }
    const wStr = String(evDoc?.waterAvailability ?? "").trim()
    const soilStr = String(evDoc?.soilType ?? "").trim()
    const locHint = [farm?.district, farm?.state].filter(Boolean).join(", ")
    let advantageLine: string
    if (wStr) {
      advantageLine = `Key advantage: water position (${wStr}) supports reliable irrigation design and reduces hydrological risk in execution planning.`
    } else if (soilStr) {
      advantageLine = `Key advantage: soil profile (${soilStr}) is compatible with the proposed agronomic package subject to field verification.`
    } else if (locHint) {
      advantageLine = `Key advantage: geography (${locHint}) supports input logistics and market linkage once crop and buyer strategy are confirmed.`
    } else {
      advantageLine = `Key advantage: completing water, soil, and offtake diligence will sharpen returns before financial close.`
    }
    const executiveSummaryLines = [landSuitLine, infraLine, investLine, advantageLine]

    const farmRec =
      farm && typeof farm === "object" ? (farm as Record<string, unknown>) : ({} as Record<string, unknown>)
    const customerName = farmEvalPdfFieldNA(
      farmRec.customerName ?? farmRec.clientName ?? farm?.name
    )
    const customerPhone = farmEvalPdfFieldNA(
      farmRec.phone ?? farmRec.mobile ?? farmRec.contactPhone ?? farmRec.customerPhone
    )
    const geoCustomerLoc = [farm?.location, farm?.district, farm?.state].filter(Boolean).join(", ")
    const customerLocation = farmEvalPdfFieldNA(geoCustomerLoc || null)

    /** Single derived snapshot for all section renderers (keep in sync; do not scatter duplicates). */
    const pdfData: FarmEvalPDFData = {
      siteName: siteDoc?.name || "Unnamed site",
      farmName: farm?.name || "N/A",
      locationStr:
        [farm?.location, farm?.district, farm?.state].filter(Boolean).join(", ") || "N/A",
      customerName,
      customerPhone,
      customerLocation,
      infraHint,
      soilRecorded: evDoc?.soilType,
      waterRecorded: evDoc?.waterAvailability,
      cropRecorded: evDoc?.cropType,
      sunRecorded: evDoc?.sunExposure || "full",
      costRows,
      costSubtotal,
      gstAmount,
      contingencyAmount,
      grandTotalCost,
      contingencyPctLabel,
      reportId,
      reportTitle: "Farm Evaluation Report",
      reportSubtitle: `${siteDoc?.name || "Site"}`,
      areaAcresLabel: `${areaAc.toFixed(2)} acres`,
      perimeterMetersLabel: `${perimeterM.toFixed(0)} m`,
      slopePctLabel: `${slopePct}%`,
      terrainLabel,
      statusLabel: statusStr.toUpperCase(),
      evaluationDateStr,
      infraTypeDisplay: infraNameRaw.replace(/_/g, " ").toUpperCase(),
      infraDescription: infraDesc[infraKeyNormalized] || infraNameRaw,
      suitabilityLabel,
      setupTimeLabel,
      mapBase64: mapPrepared.base64,
      mapImageKind: mapPrepared.imageKind,
      boundaryCompactnessRatio: compactness,
      notesText: evDoc?.notes ?? null,
      roiMonthsLabel,
      totalInvestmentAmount,
      expectedReturnAmount,
      profitMarginLabel,
      isProposalBackedCosts,
      executiveSummaryLines,
      implementationPlanLines,
      hasProposal,
      coverIssueDateDisplay,
      expectedYieldLabel,
      paybackPeriodLabel,
      profitabilityInsightParagraph,
    }

    farmEvalDrawProformaHeader(doc, ctx, pdfData)
    renderFarmEvalCustomerDetails(doc, pdfData, ctx)
    renderFarmEvalFarmDetails(doc, pdfData, ctx)
    renderFarmEvalExecutiveSummary(doc, pdfData, ctx)
    renderFarmEvalBoundaryAnalysis(doc, pdfData, ctx)
    renderFarmEvalEvaluationSummary(doc, pdfData, ctx)
    renderFarmEvalInfrastructure(doc, pdfData, ctx)
    renderFarmEvalCostEstimation(doc, pdfData, ctx)
    renderFarmEvalRoi(doc, pdfData, ctx)
    renderFarmEvalImplementationPlan(doc, pdfData, ctx)
    renderFarmEvalSiteMap(doc, pdfData, ctx)
    renderFarmEvalNotes(doc, pdfData, ctx)

    farmEvalApplyWatermarkAndFooters(doc, reportId, { footerFont: customFont })

    const buffer = Buffer.from(doc.output("arraybuffer"))
    console.log(
      `[farmEvalPDF] generation success reportId=${reportId} pages=${doc.getNumberOfPages()} bytes=${buffer.length}`
    )
    return buffer
  } catch (err) {
    console.error(`[farmEvalPDF] generation error reportId=${reportId}`, err instanceof Error ? err.stack : err)
    throw err
  }
}

function createPDF(
  title: string,
  subtitle: string,
  sections: Array<{
    heading: string
    rows: string[][]
    headers?: string[]
    twoColumn?: boolean
    leftCol?: string[][]
    rightCol?: string[][]
    mapImage?: string | null
  }>,
  reportId: string
): Buffer {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  const pageW = 210
  let y = 20
 
  // Green header bar
  doc.setFillColor(45, 101, 53)
  doc.rect(0, 0, pageW, 28, "F")
 
  // Try to load logo
  let logoLoaded = false
  const logoCandidates = [
    path.join(process.cwd(), "backend", "backend", "public", "images", "growteq-logo.png"),
    path.join(process.cwd(), "backend", "public", "images", "growteq-logo.png"),
    path.join(process.cwd(), "public", "images", "growteq-logo.png"),
    path.join(__dirname, "..", "..", "public", "images", "growteq-logo.png"),
    path.join(__dirname, "..", "..", "..", "public", "images", "growteq-logo.png"),
  ]
 
  for (const logoPath of logoCandidates) {
    if (fs.existsSync(logoPath)) {
      try {
        const logoBase64 = fs.readFileSync(logoPath).toString("base64")
        const logoDataUrl = `data:image/png;base64,${logoBase64}`
        doc.addImage(logoDataUrl, "PNG", 8, 3, 42, 20)
        logoLoaded = true
        break
      } catch (e: any) {
        console.error("Logo load failed at", logoPath, ":", e.message)
      }
    }
  }
 
  if (!logoLoaded) {
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(18)
    doc.setFont("helvetica", "bold")
    doc.text("growteq", 12, 11)
    doc.setFontSize(7)
    doc.setFont("helvetica", "normal")
    doc.text("AGRI FARMS PVT LTD", 12, 17)
  }
 
  // Title in header (right side)
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(14)
  doc.setFont("helvetica", "bold")
  doc.text(title, pageW - 12, 11, { align: "right" })
  doc.setFontSize(8)
  doc.setFont("helvetica", "normal")
  doc.text(subtitle, pageW - 12, 17, { align: "right" })
 
  // Divider line
  doc.setDrawColor(45, 101, 53)
  doc.setLineWidth(0.5)
  doc.line(10, 32, pageW - 10, 32)
 
  y = 40
 
  // Report ID and date
  doc.setFontSize(8)
  doc.setTextColor(150, 150, 150)
  doc.text(
    `Report ID: ${reportId}     Generated: ${new Date().toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    })}`,
    pageW / 2,
    y,
    { align: "center" }
  )
  y += 10
 
  for (const section of sections) {
    // ── Site Map section ──────────────────────────────────────────
    if (section.heading === "Site Map") {
      if (y > 220) {
        doc.addPage()
        y = 20
      }
 
      // Section heading
      doc.setFillColor(240, 247, 240)
      doc.rect(10, y - 5, pageW - 20, 9, "F")
      doc.setDrawColor(45, 101, 53)
      doc.setLineWidth(0.3)
      doc.rect(10, y - 5, pageW - 20, 9, "S")
      doc.setFontSize(9)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(45, 101, 53)
      doc.text("SITE MAP", 14, y + 1)
      y += 12
 
      if (section.mapImage) {
        // Embed satellite image
        try {
          const imgData = `data:image/png;base64,${section.mapImage}`
          doc.addImage(imgData, "PNG", 10, y, pageW - 20, 70)
          y += 74
        } catch (e: any) {
          console.error("Map embed error:", e.message)
          // Fallback placeholder on embed failure
          doc.setFillColor(240, 240, 240)
          doc.rect(10, y, pageW - 20, 20, "F")
          doc.setFontSize(8)
          doc.setTextColor(120, 120, 120)
          doc.text("Map image could not be rendered", pageW / 2, y + 12, { align: "center" })
          y += 24
        }
      } else {
        // No Mapbox token — simple placeholder
        doc.setFillColor(240, 240, 240)
        doc.rect(10, y, pageW - 20, 20, "F")
        doc.setFontSize(8)
        doc.setTextColor(120, 120, 120)
        doc.text(
          "Set MAPBOX_TOKEN in backend/.env to enable satellite map",
          pageW / 2,
          y + 12,
          { align: "center" }
        )
        y += 24
      }
      y += 4
      continue
    }
 
    // ── Regular sections ─────────────────────────────────────────
    if (y > 260) {
      doc.addPage()
      y = 20
    }
 
    // Section heading
    doc.setFillColor(240, 247, 240)
    doc.rect(10, y - 5, pageW - 20, 9, "F")
    doc.setDrawColor(45, 101, 53)
    doc.setLineWidth(0.3)
    doc.rect(10, y - 5, pageW - 20, 9, "S")
    doc.setFontSize(9)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(45, 101, 53)
    doc.text(section.heading.toUpperCase(), 14, y + 1)
    y += 12
 
    // Two-column layout
    if (section.twoColumn && section.leftCol && section.rightCol) {
      const midX = pageW / 2
      const maxRows = Math.max(section.leftCol.length, section.rightCol.length)
 
      for (let i = 0; i < maxRows; i++) {
        if (y > 270) {
          doc.addPage()
          y = 20
        }
        const left = section.leftCol[i]
        const right = section.rightCol[i]
 
        if (left) {
          doc.setFontSize(8)
          doc.setFont("helvetica", "normal")
          doc.setTextColor(100, 100, 100)
          doc.text(left[0] || "", 14, y)
          doc.setFont("helvetica", "bold")
          doc.setTextColor(30, 30, 30)
          doc.text(left[1] || "", 14, y + 5)
        }
        if (right) {
          doc.setFontSize(8)
          doc.setFont("helvetica", "normal")
          doc.setTextColor(100, 100, 100)
          doc.text(right[0] || "", midX + 5, y)
          doc.setFont("helvetica", "bold")
          doc.setTextColor(30, 30, 30)
          doc.text(right[1] || "", midX + 5, y + 5)
        }
        y += 12
      }
      y += 4
    } else if (section.rows.length > 0) {
      // Table headers
      if (section.headers && section.headers.length > 0) {
        doc.setFillColor(45, 101, 53)
        doc.rect(10, y - 4, pageW - 20, 8, "F")
        doc.setFontSize(8)
        doc.setFont("helvetica", "bold")
        doc.setTextColor(255, 255, 255)
        const colW = (pageW - 20) / section.headers.length
        section.headers.forEach((h, i) => {
          doc.text(String(h || ""), 13 + i * colW, y + 1)
        })
        y += 7
      }
 
      // Table rows
      doc.setFont("helvetica", "normal")
      doc.setFontSize(8)
      section.rows.forEach((row, ri) => {
        if (y > 270) {
          doc.addPage()
          y = 20
        }
        if (ri % 2 === 0) {
          doc.setFillColor(248, 252, 248)
          doc.rect(10, y - 3, pageW - 20, 7, "F")
        }
        doc.setDrawColor(220, 220, 220)
        doc.setLineWidth(0.2)
        doc.line(10, y + 4, pageW - 10, y + 4)
        doc.setTextColor(50, 50, 50)
        const colW = (pageW - 20) / (row.length || 1)
        row.forEach((cell, ci) => {
          doc.text(String(cell || "-").substring(0, 60), 13 + ci * colW, y + 1)
        })
        y += 7
      })
 
      // Total row for cost tables
      if (section.heading.toLowerCase().includes("cost")) {
        const total = section.rows.reduce((sum, row) => {
          const lastCell = row[row.length - 1] || ""
          const digitsOnly = lastCell.replace(/[^0-9]/g, "")
          const num = parseInt(digitsOnly, 10)
          return sum + (isNaN(num) ? 0 : num)
        }, 0)
        if (total > 0) {
          doc.setFillColor(240, 247, 240)
          doc.rect(10, y - 3, pageW - 20, 8, "F")
          doc.setFont("helvetica", "bold")
          doc.setTextColor(45, 101, 53)
          doc.setFontSize(9)
          doc.text("TOTAL", 13, y + 2)
          doc.text(
            `Rs.${Math.round(total).toLocaleString("en-IN")}`,
            pageW - 13,
            y + 2,
            { align: "right" }
          )
          y += 10
        }
      }
      y += 4
    }
  }
 
  // Footer
  const footerY = 285
  doc.setFillColor(45, 101, 53)
  doc.rect(0, footerY, pageW, 12, "F")
  doc.setFontSize(7)
  doc.setTextColor(255, 255, 255)
  doc.setFont("helvetica", "normal")
  doc.text("Growteq Agri Farms Pvt Ltd", 14, footerY + 7)
  doc.text(reportId, pageW / 2, footerY + 7, { align: "center" })
  doc.text(
    new Date().toLocaleDateString("en-IN"),
    pageW - 14,
    footerY + 7,
    { align: "right" }
  )
 
  return Buffer.from(doc.output("arraybuffer"))
}
 
function reportTypeFromFileName(fileName: string): (typeof REPORT_TYPES)[number] | null {
  const lower = fileName.toLowerCase()
  if (lower.startsWith("report-site_evaluation-") || lower.startsWith("farm-report-")) return "site_evaluation"
  if (lower.startsWith("report-infrastructure_proposal-") || lower.startsWith("proposal-")) return "infrastructure_proposal"
  if (lower.startsWith("report-cost_estimate-")) return "cost_estimate"
  if (lower.startsWith("report-sales_pipeline-")) return "sales_pipeline"
  if (lower.startsWith("report-site_comparison-")) return "site_comparison"
  if (lower.startsWith("report-executive_summary-")) return "executive_summary"
  return null
}
 
export const listReports = asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
  const reportsDir = path.join(__dirname, "..", "..", "public", "reports")
 
  if (!fs.existsSync(reportsDir)) {
    return res.json({ success: true, data: [] })
  }
 
  const files = fs.readdirSync(reportsDir).filter((f) => f.toLowerCase().endsWith(".pdf"))
 
  const data = files.map((fileName) => {
    const filePath = path.join(reportsDir, fileName)
    const stat = fs.statSync(filePath)
 
    let type: "farm" | "proposal" | "unknown" = "unknown"
    if (fileName.startsWith("farm-report-")) {
      type = "farm"
    } else if (fileName.startsWith("proposal-") || fileName.startsWith("proposal-report-")) {
      type = "proposal"
    }
 
    return {
      type,
      url: `/reports/${fileName}`,
      createdAt: stat.mtime.toISOString(),
    }
  })
 
  res.json({ success: true, data })
})

/** Flat file list for Report History UI: fileName, inferred report type, mtime. */
export const listReportFiles = asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
  const reportsDir = path.join(__dirname, "..", "..", "public", "reports")
  if (!fs.existsSync(reportsDir)) {
    return res.json({ success: true, data: [] })
  }
  const names = fs
    .readdirSync(reportsDir)
    .filter((f) => {
      const low = f.toLowerCase()
      return low.endsWith(".pdf") || low.endsWith(".csv")
    })
  const data = names
    .map((fileName) => {
      const filePath = path.join(reportsDir, fileName)
      let stat: fs.Stats
      try {
        stat = fs.statSync(filePath)
      } catch {
        return null
      }
      const inferred = reportTypeFromFileName(fileName)
      return {
        fileName,
        type: inferred ?? "unknown",
        createdAt: stat.mtime.toISOString(),
      }
    })
    .filter((row): row is NonNullable<typeof row> => row != null)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  res.json({ success: true, data })
})
 
export const listReportTypes = asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const REPORT_TYPES_WITH_TITLES = [
      { reportType: "site_evaluation", title: "Site Evaluation Report" },
      { reportType: "infrastructure_proposal", title: "Infrastructure Proposal" },
      { reportType: "cost_estimate", title: "Cost Estimate Summary" },
      { reportType: "sales_pipeline", title: "Sales Pipeline Report" },
      { reportType: "site_comparison", title: "Site Comparison Matrix" },
      { reportType: "executive_summary", title: "Executive Summary" },
    ] as const
 
    const reportsDir = path.join(__dirname, "..", "..", "public", "reports")
    let files: string[] = []
 
    try {
      if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir, { recursive: true })
      }
      files = fs.readdirSync(reportsDir).filter(
        (f) => f.toLowerCase().endsWith(".pdf") || f.toLowerCase().endsWith(".csv")
      )
    } catch {
      files = []
    }
 
    const result = REPORT_TYPES_WITH_TITLES.map((rt) => {
      const matching = files
        .filter((f) => f.includes(rt.reportType) && (f.endsWith(".pdf") || f.endsWith(".csv")))
        .sort()
        .reverse()

      const pdfFiles = matching.filter((f) => f.toLowerCase().endsWith(".pdf")).sort().reverse()
      const excelFiles = matching.filter((f) => f.toLowerCase().endsWith(".csv")).sort().reverse()

      let lastGeneratedAt: string | null = null
      if (matching.length > 0) {
        try {
          const stat = fs.statSync(path.join(reportsDir, matching[0]))
          lastGeneratedAt = stat.mtime.toISOString().split("T")[0]
        } catch {
          lastGeneratedAt = null
        }
      }

      return {
        reportType: rt.reportType,
        title: rt.title,
        lastGeneratedAt,
        pdfFileName: pdfFiles[0] ?? null,
        excelFileName: excelFiles[0] ?? null,
      }
    })
 
    return res.json({ success: true, data: result })
  } catch (err: any) {
    console.error("listReportTypes error:", err?.message || err)
    return res.status(500).json({
      success: false,
      error: "Failed to list report types",
    })
  }
})
 
export const downloadReport = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { fileName } = req.params as { fileName?: string }
  const { absPath, baseName } = resolveSafeReportFile(fileName, ["pdf", "csv"])

  if (!fs.existsSync(absPath)) {
    throw new ApiError(404, "Report not found")
  }

  res.setHeader("Content-Disposition", `attachment; filename="${baseName}"`)
  res.sendFile(absPath)
})
 
export const generateProposalReport = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.auth!.userId
    const proposalId = req.params.proposalId
 
    if (!proposalId) {
      throw new ApiError(400, "proposalId is required")
    }
 
    const proposal = await Proposal.findOne({ _id: proposalId, userId })
      .populate("siteId")
      .populate("siteEvaluationId")
      .lean()
 
    if (!proposal) {
      throw new ApiError(404, "Proposal not found")
    }
 
    const site = proposal.siteId as { name?: string; area?: number; slope?: number } | null
    const evaluation = proposal.siteEvaluationId as { name?: string; area?: number; slope?: number } | null
    const siteName = site?.name ?? evaluation?.name ?? "Site"
    const area = site?.area ?? evaluation?.area ?? 0
    const slope = site?.slope ?? evaluation?.slope ?? 0
    const infrastructureType =
      proposal.infrastructureType ??
      (proposal.content as { infrastructureType?: string })?.infrastructureType ??
      "N/A"
    const investmentValue =
      proposal.investmentValue ??
      (proposal.content as { investment?: number; investmentValue?: number })?.investment ??
      (proposal.content as { investmentValue?: number })?.investmentValue ??
      0
    const roiMonths =
      proposal.roiMonths ??
      (proposal.content as { roiMonths?: number })?.roiMonths ??
      0
 
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
    const pageWidth = doc.internal.pageSize.getWidth()
    let y = 20
 
    doc.setFontSize(16)
    doc.text("Infrastructure Proposal Report", pageWidth / 2, y, { align: "center" })
    y += 12
 
    doc.setFontSize(11)
    doc.text(`Site: ${siteName}`, 20, y)
    y += 6
    doc.text(`Area: ${area} acres`, 20, y)
    y += 6
    doc.text(`Slope: ${slope}%`, 20, y)
    y += 8
    doc.text(`Infrastructure type: ${infrastructureType}`, 20, y)
    y += 6
    doc.text(
      `Investment value: Rs.${Number(investmentValue).toLocaleString("en-IN")}`,
      20,
      y
    )
    y += 6
    doc.text(`ROI: ${roiMonths} months`, 20, y)
    y += 12
    doc.setFontSize(9)
    doc.setTextColor(120)
    doc.text("Generated by Growteq Farm Management System", 20, y)
 
    const buffer = Buffer.from(doc.output("arraybuffer"))
    const reportsDir = path.join(__dirname, "..", "..", "public", "reports")
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true })
    }
    const fileName = `${proposalId}.pdf`
    const filePath = path.join(reportsDir, fileName)
    fs.writeFileSync(filePath, buffer)
 
    const downloadUrl = `/api/reports/download/${fileName}`
 
    const proposalUserId = String(proposal.userId)
    await createNotification({
      userId: proposalUserId,
      title: "Proposal report ready",
      message: "Proposal report ready for download",
      type: "success",
      relatedEntityType: "Proposal",
      relatedEntityId: proposal._id,
    })
 
    res.status(201).json({
      success: true,
      data: { fileName, downloadUrl },
    })
  }
)
 
export const deleteReport = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { fileName } = req.params as { fileName?: string }
  const { absPath } = resolveSafeReportFile(fileName, ["pdf"])

  if (!fs.existsSync(absPath)) {
    throw new ApiError(404, "Report not found")
  }

  fs.unlinkSync(absPath)

  res.json({ success: true, message: "Deleted successfully" })
})
 
export const generateFarmReport = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.auth!.userId
    const { farmId } = req.params as { farmId?: string }
 
    if (!farmId) {
      throw new ApiError(400, "farmId is required")
    }
 
    const sites = await SiteEvaluation.find({ userId, farmId })
 
    if (!sites.length) {
      throw new ApiError(404, "No sites found for this farm")
    }
 
    const siteById = new Map<string, (typeof sites)[number]>()
    const siteIds: string[] = []
    for (const site of sites) {
      const id = String(site._id)
      siteById.set(id, site)
      siteIds.push(id)
    }
 
    const proposals = await Proposal.find({
      userId,
      siteEvaluationId: { $in: siteIds },
    }).sort({ createdAt: -1 })
 
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    let y = 20
 
    doc.setFontSize(14)
    doc.text("Farm Proposal Summary Report", pageWidth / 2, y, { align: "center" })
    y += 8
 
    doc.setFontSize(10)
    doc.text(`Farm ID: ${farmId}`, 20, y)
    y += 6
    doc.text(`Generated: ${new Date().toLocaleString("en-IN")}`, 20, y)
    y += 10
 
    if (!proposals.length) {
      doc.text("No proposals found for this farm.", 20, y)
    } else {
      doc.setFontSize(11)
      doc.text("Proposals by Site", 20, y)
      y += 8
      doc.setFontSize(10)
 
      for (const proposal of proposals) {
        const siteId = String(proposal.siteEvaluationId)
        const site = siteById.get(siteId)
 
        const content = (proposal.content ?? {}) as {
          infrastructureType?: string
          estimatedCost?: number
          roiMonths?: number
          suitabilityScore?: number
        }
 
        if (y > pageHeight - 40) {
          doc.addPage()
          y = 20
        }
 
        doc.setFontSize(10)
        doc.text(`Site: ${site?.name ?? "Unknown"} (ID: ${siteId})`, 20, y)
        y += 5
        doc.text(
          `Area: ${site?.area ?? 0} ${(site as any)?.areaUnit ?? "acres"} | Status: ${site?.status ?? "draft"}`,
          20,
          y
        )
        y += 5
 
        const infra = content.infrastructureType ?? "N/A"
        const cost =
          typeof content.estimatedCost === "number"
            ? `Rs.${content.estimatedCost.toLocaleString("en-IN")}`
            : "N/A"
        const roi =
          typeof content.roiMonths === "number"
            ? `${content.roiMonths} months`
            : "N/A"
        const score =
          typeof content.suitabilityScore === "number"
            ? `${content.suitabilityScore.toFixed(1)}`
            : "N/A"
 
        doc.text(`Infrastructure: ${infra}`, 20, y)
        y += 5
        doc.text(`Estimated Cost: ${cost}`, 20, y)
        y += 5
        doc.text(`ROI: ${roi}`, 20, y)
        y += 5
        doc.text(`Suitability Score: ${score}`, 20, y)
        y += 8
      }
    }
 
    doc.setFontSize(9)
    doc.setTextColor(120)
    doc.text("Generated by Growteq Farm Planning System", 20, pageHeight - 14)
    doc.text("Growteq Agri Farms Pvt Ltd", 20, pageHeight - 6)
 
    const buffer = Buffer.from(doc.output("arraybuffer"))
 
    const reportsDir = path.join(__dirname, "..", "..", "public", "reports")
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true })
    }
 
    const fileName = `farm-report-${farmId}-${Date.now()}.pdf`
    const filePath = path.join(reportsDir, fileName)
    fs.writeFileSync(filePath, buffer)
 
    res.json({ success: true, url: `/reports/${fileName}` })
  }
)
 
export const generateReport = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const startTime = Date.now()
      const PDF_TIMEOUT = 30000 // 30 seconds

      const userId = req.auth!.userId
      const { reportType, siteIds, format } = req.body as {
        reportType?: string
        siteIds?: string[]
        format?: "pdf" | "excel"
      }
 
      if (!reportType || !REPORT_TYPES.includes(reportType as (typeof REPORT_TYPES)[number])) {
        throw new ApiError(400, "reportType must be one of: " + REPORT_TYPES.join(", "))
      }
      const fmt = format === "excel" ? "excel" : "pdf"
 
      const reportsDir = path.join(__dirname, "..", "..", "public", "reports")
      if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir, { recursive: true })
      }
 
      const timestamp = Date.now()
      const safeType = (reportType as string).replace(/[^a-z_]/gi, "_")
      const ext = fmt === "excel" ? "csv" : "pdf"
      const fileName = `report-${safeType}-${timestamp}.${ext}`
      const filePath = path.join(reportsDir, fileName)
 
      if (fmt === "pdf") {
        let pdfBuffer: Buffer
        const reportId = `RPT-${timestamp}`
 
        if (reportType === "site_evaluation") {
          const userFarms = (await Farm.find({ userId }).lean()) as any[]
          const farmIds = userFarms.map((f) => f._id.toString())
          const farmObjectIds = farmIds.map((id) => new mongoose.Types.ObjectId(id))
          const farmMap = new Map(userFarms.map((f) => [f._id.toString(), f]))

          const requestedSiteId =
            siteIds?.length && mongoose.Types.ObjectId.isValid(String(siteIds[0]))
              ? new mongoose.Types.ObjectId(String(siteIds[0]))
              : null

          let latestEval: any
          if (requestedSiteId) {
            latestEval = await SiteEvaluation.findOne({
              siteId: requestedSiteId,
              farmId: { $in: farmObjectIds },
            })
              .sort({ createdAt: -1 })
              .lean()
          } else {
            latestEval = await SiteEvaluation.findOne({
              siteId: {
                $in: await Site.find({ farmId: { $in: farmIds } }).distinct("_id"),
              },
            })
              .sort({ createdAt: -1 })
              .lean()
          }

          if (!latestEval) {
            return res.status(404).json({
              success: false,
              error: requestedSiteId
                ? "No site evaluation found for this site. Complete an evaluation first."
                : "No site evaluations found. Please evaluate a site first.",
            })
          }

          // Get only that one site
          const site = (await Site.findById(latestEval.siteId).lean()) as any
          if (!site) {
            return res.status(404).json({
              success: false,
              error: "Site not found",
            })
          }

          const farm = farmMap.get(site.farmId?.toString() || "") as any

          const ev = latestEval
          const prop = (await Proposal.findOne({ siteId: site._id })
            .sort({ createdAt: -1 })
            .lean()) as any

          const mapBase64 = site.geojson ? await getMapboxImage(site.geojson) : null

          pdfBuffer = await createFarmEvaluationProformaPDF(site, farm, ev, prop, mapBase64, reportId)
 
        } else if (reportType === "infrastructure_proposal") {
          const farms = (await Farm.find({ userId }).lean()) as any[]
          const farmIds = farms.map((f) => String(f._id))
          const sites = (await Site.find({ farmId: { $in: farmIds } }).lean()) as any[]
          const allSiteIds = sites.map((s) => s._id)
          const proposals = (await Proposal.find({ siteId: { $in: allSiteIds }, status: "recommended" })
            .populate("siteId", "name area").lean()) as any[]
 
          pdfBuffer = createPDF(
            "Infrastructure Proposal",
            "Detailed proposal with cost breakdown and ROI timeline",
            [{
              heading: "Proposals",
              headers: ["Site", "Area", "Infrastructure", "Investment", "ROI (mo)"],
              rows: proposals.map((p) => [
                (p.siteId as any)?.name || "-",
                `${(((p.siteId as any)?.area || 0) as number).toFixed(2)} ac`,
                p.infrastructureType || "-",
                p.investmentValue ? `Rs.${Math.round(p.investmentValue).toLocaleString("en-IN")}` : "-",
                String(p.roiMonths || "-"),
              ]),
            }],
            reportId
          )
 
        } else if (reportType === "cost_estimate") {
          const farms = (await Farm.find({ userId }).lean()) as any[]
          const farmIds = farms.map((f) => String(f._id))
          const sites = (await Site.find({ farmId: { $in: farmIds } }).lean()) as any[]
          const allSiteIds = sites.map((s) => s._id)
          const proposals = (await Proposal.find({ siteId: { $in: allSiteIds } }).lean()) as any[]
          const grouped: Record<string, { total: number; count: number; roi: number }> = {}
          for (const p of proposals) {
            const t = (p as any).infrastructureType || "unknown"
            if (!grouped[t]) grouped[t] = { total: 0, count: 0, roi: 0 }
            grouped[t].total += (p as any).investmentValue || 0
            grouped[t].count += 1
            grouped[t].roi += (p as any).roiMonths || 0
          }
          const grandTotal = Object.values(grouped).reduce((s, g) => s + g.total, 0)
 
          pdfBuffer = createPDF(
            "Cost Estimate Summary",
            "Comprehensive cost analysis by infrastructure type",
            [{
              heading: "Cost Breakdown",
              headers: ["Infrastructure", "Total Investment", "Avg ROI", "% of Total"],
              rows: Object.entries(grouped).map(([type, g]) => [
                type,
                `Rs.${Math.round(g.total).toLocaleString("en-IN")}`,
                `${(g.count > 0 ? g.roi / g.count : 0).toFixed(1)} mo`,
                `${grandTotal > 0 ? ((g.total / grandTotal) * 100).toFixed(1) : 0}%`,
              ]),
            }],
            reportId
          )
 
        } else if (reportType === "sales_pipeline") {
          const farms = (await Farm.find({ userId }).lean()) as any[]
          const farmIds = farms.map((f) => String(f._id))
          const sites = (await Site.find({ farmId: { $in: farmIds } }).lean()) as any[]
          const allSiteIds = sites.map((s) => s._id)
          const evals = (await SiteEvaluation.find({ siteId: { $in: allSiteIds } }).lean()) as any[]
          const grouped: Record<string, { count: number; inv: number }> = {}
          for (const e of evals) {
            const s = (e as any).status || "draft"
            if (!grouped[s]) grouped[s] = { count: 0, inv: 0 }
            grouped[s].count += 1
            grouped[s].inv += (e as any).calculatedInvestment || 0
          }
 
          pdfBuffer = createPDF(
            "Sales Pipeline Report",
            "Sales funnel and conversion tracking",
            [{
              heading: "Pipeline by Stage",
              headers: ["Stage", "Count", "Total Investment", "Avg per Site"],
              rows: ["draft", "submitted", "approved", "rejected"].map((stage) => {
                const g = grouped[stage] || { count: 0, inv: 0 }
                return [
                  stage.toUpperCase(),
                  String(g.count),
                  `Rs.${Math.round(g.inv).toLocaleString("en-IN")}`,
                  g.count > 0 ? `Rs.${Math.round(g.inv / g.count).toLocaleString("en-IN")}` : "-",
                ]
              }),
            }],
            reportId
          )
 
        } else if (reportType === "site_comparison") {
          const farms = (await Farm.find({ userId }).lean()) as any[]
          const farmIds = farms.map((f) => String(f._id))
          const sites = (await Site.find({ farmId: { $in: farmIds } }).lean()) as any[]
          const allSiteIds = sites.map((s) => s._id)
          const proposals = (await Proposal.find({ siteId: { $in: allSiteIds } }).lean()) as any[]
          const propMap: Record<string, number> = {}
          for (const p of proposals) {
            const k = String((p as any).siteId)
            propMap[k] = (propMap[k] || 0) + ((p as any).investmentValue || 0)
          }
          const ranked = sites
            .map((s) => ({ ...s, totalInv: propMap[String(s._id)] || 0 }))
            .sort((a, b) => (b.area || 0) - (a.area || 0))
 
          pdfBuffer = createPDF(
            "Site Comparison Matrix",
            "Side-by-side analysis of all site evaluations",
            [{
              heading: "Site Rankings",
              headers: ["Rank", "Site", "Area (ac)", "Total Investment"],
              rows: ranked.map((s, i) => [
                `#${i + 1}`,
                s.name || "-",
                `${(s.area || 0).toFixed(2)}`,
                `Rs.${Math.round(s.totalInv).toLocaleString("en-IN")}`,
              ]),
            }],
            reportId
          )
 
        } else {
          // executive_summary
          const farms = (await Farm.find({ userId }).lean()) as any[]
          const farmIds = farms.map((f) => String(f._id))
          const sites = (await Site.find({ farmId: { $in: farmIds } }).lean()) as any[]
          const allSiteIds = sites.map((s) => s._id)
          const proposals = (await Proposal.find({ siteId: { $in: allSiteIds } }).lean()) as any[]
          const totalInv = proposals.reduce((s, p) => s + ((p as any).investmentValue || 0), 0)
          const avgRoi =
            proposals.length > 0
              ? proposals.reduce((s, p) => s + ((p as any).roiMonths || 0), 0) / proposals.length
              : 0
          const bestSite = [...sites].sort((a, b) => (b.area || 0) - (a.area || 0))[0]
          const totalArea = sites.reduce((s, st) => s + ((st.area || 0) as number), 0)
 
          pdfBuffer = createPDF(
            "Executive Summary",
            "High-level overview for stakeholders and management",
            [{
              heading: "Key Metrics",
              headers: ["Metric", "Value"],
              rows: [
                ["Total Sites", String(sites.length)],
                ["Total Area", `${totalArea.toFixed(2)} acres`],
                ["Total Proposals", String(proposals.length)],
                ["Total Investment", `Rs.${Math.round(totalInv).toLocaleString("en-IN")}`],
                ["Expected Return (115%)", `Rs.${Math.round(totalInv * 1.15).toLocaleString("en-IN")}`],
                ["Average ROI", `${avgRoi.toFixed(1)} months`],
                ["Best Site", bestSite ? `${bestSite.name} (${(bestSite.area || 0).toFixed(2)} ac)` : "-"],
              ],
            }],
            reportId
          )
        }
 
        fs.writeFileSync(filePath, pdfBuffer)

        const duration = Date.now() - startTime
        if (duration > 10000) {
          console.warn(`⚠️ Slow PDF generation: ${duration}ms`)
        }
        if (duration > PDF_TIMEOUT) {
          console.warn(`⚠️ PDF generation exceeded ${PDF_TIMEOUT}ms`)
        }

        try {
          const stats = fs.statSync(filePath)
          const fileSizeKB = Math.round(stats.size / 1024)
          if (fileSizeKB < 5) {
            console.warn("⚠️ PDF file size suspiciously small — may be empty")
          }
        } catch {
          // ignore stat errors
        }
      } else {
        const header = "Report Type,Generated At,Site IDs\n"
        const row = `${reportType},${new Date().toISOString().slice(0, 10)},${(siteIds ?? []).join(";")}\n`
        fs.writeFileSync(filePath, header + row, "utf8")
      }
 
      const downloadUrl = `/api/reports/download/${fileName}`
      res.status(201).json({ success: true, data: { fileName, downloadUrl } })
 
    } catch (err: any) {
      console.error("generateReport error:", err?.message || err, err?.stack)
      return res.status(500).json({
        success: false,
        error: err?.message || "Report generation failed",
      })
    }
  }
)