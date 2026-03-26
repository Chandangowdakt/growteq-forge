import fs from "fs"
import path from "path"
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
 
async function getMapboxImage(geojson: any): Promise<string | null> {
  console.log("=== getMapboxImage called ===")
  console.log("MAPBOX_TOKEN set:", !!process.env.MAPBOX_TOKEN)
  console.log(
    "MAPBOX_TOKEN value preview:",
    process.env.MAPBOX_TOKEN?.substring(0, 15) + "..."
  )
  console.log("geojson received:", !!geojson)
  console.log("coords length:", geojson?.coordinates?.[0]?.length)

  const token = process.env.MAPBOX_TOKEN
  if (!token) {
    console.log("No MAPBOX_TOKEN set")
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
          stroke: "#16a34a",
          "stroke-width": 3,
          fill: "#22c55e",
          "fill-opacity": 0.25,
        },
        geometry: geojson,
      })
    )
 
    const url = `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/geojson(${overlay})/${centerLng},${centerLat},16,0/600x350?access_token=${token}`

    console.log("Mapbox URL length:", url.length)
    console.log("Mapbox URL preview:", url.substring(0, 100))

    console.log("Fetching Mapbox satellite image...")
 
    const buffer = await new Promise<Buffer | null>((resolve) => {
      const https = require("https")
      const req = https.get(url, { timeout: 10000 }, (res: any) => {
        if (res.statusCode !== 200) {
          console.log("Mapbox returned status:", res.statusCode)
          resolve(null)
          return
        }
        const chunks: Buffer[] = []
        res.on("data", (c: Buffer) => chunks.push(c))
        res.on("end", () => resolve(Buffer.concat(chunks)))
        res.on("error", () => resolve(null))
      })
      req.on("error", (e: any) => {
        console.log("Mapbox request error:", e.message)
        resolve(null)
      })
      req.on("timeout", () => {
        req.destroy()
        resolve(null)
      })
    })

    console.log("Buffer received:", !!buffer)
    console.log("Buffer size:", buffer?.length)

    if (!buffer) return null
    console.log("✓ Mapbox satellite image fetched, size:", buffer.length)
    return buffer.toString("base64")
  } catch (e: any) {
    console.error("getMapboxImage error:", e.message)
    return null
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
        console.log("✓ Logo loaded from:", logoPath)
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
      console.log("=== Site Map section hit ===")
      console.log("section.mapImage exists:", !!section.mapImage)
      console.log("section.mapImage length:", section.mapImage?.length)

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
          console.log("✓ Satellite map embedded in PDF")
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
 
  if (!fileName) {
    throw new ApiError(400, "fileName is required")
  }
 
  const reportsDir = path.join(__dirname, "..", "..", "public", "reports")
  const filePath = path.join(reportsDir, fileName)
 
  if (!fs.existsSync(filePath)) {
    throw new ApiError(404, "Report not found")
  }
 
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`)
  res.sendFile(path.resolve(filePath))
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
 
  if (!fileName) {
    throw new ApiError(400, "fileName is required")
  }
 
  const reportsDir = path.join(__dirname, "..", "..", "public", "reports")
  const filePath = path.join(reportsDir, fileName)
 
  if (!fs.existsSync(filePath)) {
    throw new ApiError(404, "Report not found")
  }
 
  fs.unlinkSync(filePath)
 
  res.json({ success: true })
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
          // Get the most recently created SiteEvaluation for this user
          const userFarms = (await Farm.find({ userId }).lean()) as any[]
          const farmIds = userFarms.map((f) => f._id.toString())
          const farmMap = new Map(userFarms.map((f) => [f._id.toString(), f]))

          // Find the LATEST evaluation only
          const latestEval = (await SiteEvaluation.findOne({
            siteId: {
              $in: await Site.find({ farmId: { $in: farmIds } }).distinct("_id"),
            },
          })
            .sort({ createdAt: -1 })
            .lean()) as any

          if (!latestEval) {
            return res.status(404).json({
              success: false,
              error: "No site evaluations found. Please evaluate a site first.",
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

          const sites = [site]
          const farm = farmMap.get(site.farmId?.toString() || "") as any

          // Get evaluation and proposal for this site only
          const ev = latestEval
          const prop = (await Proposal.findOne({ siteId: site._id })
            .sort({ createdAt: -1 })
            .lean()) as any

          const allSections: {
            heading: string
            rows: string[][]
            headers?: string[]
            twoColumn?: boolean
            leftCol?: string[][]
            rightCol?: string[][]
            mapImage?: string | null
          }[] = []

          // Summary - just this one site
          allSections.push({
            heading: "Summary",
            twoColumn: true,
            rows: [],
            leftCol: [
              ["Site Evaluated", site.name || "N/A"],
              ["Area", `${(site.area || 0).toFixed(2)} acres`],
            ],
            rightCol: [
              ["Evaluation Date", new Date(ev.createdAt).toLocaleDateString("en-IN")],
              ["Organization", "Growteq Agri Farms Pvt Ltd"],
            ],
          })

          // Farm & Land info
          allSections.push({
            heading: `Site: ${site.name || "Unnamed"}`,
            twoColumn: true,
            rows: [],
            leftCol: [
              ["Farm Name", farm?.name || "N/A"],
              ["Site Name", site.name || "N/A"],
              [
                "Location",
                [farm?.location, farm?.district, farm?.state].filter(Boolean).join(", ") ||
                  "N/A",
              ],
              ["Status", ((site as any).status || ev?.status || "draft").toUpperCase()],
            ],
            rightCol: [
              ["Area", `${(site.area || 0).toFixed(2)} acres`],
              ["Perimeter", `${(site.perimeter || 0).toFixed(0)} m`],
              ["Slope", `${site.slope || 2.5}%`],
              ["Terrain", (site.slope || 2.5) <= 5 ? "Suitable" : "Moderate"],
            ],
          })

          // Site analysis (if ev exists)
          if (ev) {
            allSections.push({
              heading: "Site Analysis",
              twoColumn: true,
              rows: [],
              leftCol: [
                ["Soil Type", ev.soilType || "N/A"],
                ["Water Availability", ev.waterAvailability || "N/A"],
                ["Sun Exposure", ev.sunExposure || "full"],
              ],
              rightCol: [
                ["Slope %", `${ev.slopePercentage || site.slope || 2.5}%`],
                ["Elevation", "N/A"],
                ["Crop Type", ev.cropType || "N/A"],
              ],
            })

            const infraName = ev.infrastructureRecommendation || prop?.infrastructureType || "N/A"
            const infraDesc: Record<string, string> = {
              polyhouse: "Polyhouse greenhouse system - Climate controlled farming environment",
              shade_net: "Shade Net structure - Sun protection and UV filtering system",
              open_field: "Open Field cultivation - Traditional farming with minimal infrastructure",
            }

            allSections.push({
              heading: "Recommended Infrastructure",
              twoColumn: true,
              rows: [],
              leftCol: [
                ["Type", infraName.replace(/_/g, " ").toUpperCase()],
                ["Description", infraDesc[infraName] || infraName],
              ],
              rightCol: [
                ["Suitability", (site.slope || 2.5) <= 5 ? "High" : "Medium"],
                [
                  "Est. Setup Time",
                  infraName === "polyhouse"
                    ? "90 days"
                    : infraName === "shade_net"
                      ? "30 days"
                      : "14 days",
                ],
              ],
            })
          }

          // Cost & ROI (if prop exists)
          if (prop) {
            const inv = prop.investmentValue || 0
            const infraTypeRaw = String(prop.infrastructureType || "polyhouse").toLowerCase().replace(/\s+/g, "_")
            const infraMap = await getInfrastructureMap()
            const infraKey =
              infraTypeRaw === "shade_net" || infraTypeRaw === "shadenet"
                ? "shade_net"
                : infraTypeRaw === "open_field" || infraTypeRaw === "openfield"
                  ? "open_field"
                  : "polyhouse"

            const snap = ev?.infrastructureSnapshot as
              | { type?: string; roiMonths?: number }
              | undefined
            const roiMonthsForPdf =
              snap != null &&
              typeof snap.roiMonths === "number" &&
              Number.isFinite(snap.roiMonths)
                ? snap.roiMonths
                : prop.roiMonths ?? infraMap[infraKey]?.roiMonths

            let costRows: string[][] = []
            if (infraKey === "polyhouse") {
              costRows = [
                ["Polyhouse Structure", `Rs.${Math.round(inv * 0.68).toLocaleString("en-IN")}`],
                ["Irrigation System", `Rs.${Math.round(inv * 0.18).toLocaleString("en-IN")}`],
                ["Climate Control", `Rs.${Math.round(inv * 0.11).toLocaleString("en-IN")}`],
                ["Miscellaneous", `Rs.${Math.round(inv * 0.03).toLocaleString("en-IN")}`],
              ]
            } else if (infraKey === "shade_net") {
              costRows = [
                ["Shade Net Structure", `Rs.${Math.round(inv * 0.65).toLocaleString("en-IN")}`],
                ["Support Framework", `Rs.${Math.round(inv * 0.20).toLocaleString("en-IN")}`],
                ["Irrigation", `Rs.${Math.round(inv * 0.10).toLocaleString("en-IN")}`],
                ["Miscellaneous", `Rs.${Math.round(inv * 0.05).toLocaleString("en-IN")}`],
              ]
            } else {
              costRows = [
                ["Land Preparation", `Rs.${Math.round(inv * 0.40).toLocaleString("en-IN")}`],
                ["Irrigation Setup", `Rs.${Math.round(inv * 0.35).toLocaleString("en-IN")}`],
                ["Equipment", `Rs.${Math.round(inv * 0.25).toLocaleString("en-IN")}`],
              ]
            }

            allSections.push({
              heading: "Cost Estimation",
              headers: ["Component", "Cost"],
              rows: costRows,
            })

            allSections.push({
              heading: "ROI Analysis",
              twoColumn: true,
              rows: [],
              leftCol: [
                ["Total Investment", `Rs.${Math.round(inv).toLocaleString("en-IN")}`],
                ["ROI Timeline", `${roiMonthsForPdf ?? "N/A"} months`],
              ],
              rightCol: [
                ["Expected Return", `Rs.${Math.round(inv * 1.15).toLocaleString("en-IN")}`],
                ["Profit Margin", infraKey === "polyhouse" ? "37.5%" : "15%"],
              ],
            })
          }

          // ONE map for this ONE site
          console.log("=== Calling getMapboxImage for site:", site.name)
          console.log("Site geojson type:", site.geojson?.type)
          console.log(
            "Site geojson coords count:",
            site.geojson?.coordinates?.[0]?.length
          )

          const mapBase64 = site.geojson ? await getMapboxImage(site.geojson) : null
          console.log(
            "mapBase64 result:",
            mapBase64 ? `string length ${mapBase64.length}` : "NULL"
          )

          allSections.push({
            heading: "Site Map",
            rows: [],
            mapImage: mapBase64,
          })

          if (ev?.notes) {
            allSections.push({ heading: "Notes", rows: [[ev.notes]] })
          }

          pdfBuffer = createPDF(
            "Site Evaluation Report",
            `${site.name || "Site"} — Complete assessment with infrastructure recommendations`,
            allSections,
            reportId
          )
 
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
        console.log(`PDF generated in ${duration}ms for reportType: ${reportType}`)
        if (duration > 10000) {
          console.warn(`⚠️ Slow PDF generation: ${duration}ms`)
        }
        if (duration > PDF_TIMEOUT) {
          console.warn(`⚠️ PDF generation exceeded ${PDF_TIMEOUT}ms`)
        }

        try {
          const stats = fs.statSync(filePath)
          const fileSizeKB = Math.round(stats.size / 1024)
          console.log(`PDF file size: ${fileSizeKB}KB`)
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