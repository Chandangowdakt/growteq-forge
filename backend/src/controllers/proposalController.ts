import { Response } from "express"
import { jsPDF } from "jspdf"
import fs from "fs"
import path from "path"
import { Proposal } from "../models/Proposal"
import { SiteEvaluation } from "../models/SiteEvaluation"
import { ApiError } from "../utils/ApiError"
import { asyncHandler } from "../utils/asyncHandler"
import { AuthenticatedRequest } from "../middleware/auth"
import { createProposalFromRecommendation } from "../services/recommendationService"

async function fetchSiteMapSnapshotUrl(
  req: AuthenticatedRequest,
  siteId: string
): Promise<string | null> {
  const host = req.get("host")
  if (!host) return null

  const origin = `${req.protocol}://${host}`
  const authHeader = req.headers.authorization

  try {
    const response = await fetch(`${origin}/api/maps/snapshot`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify({
        siteId,
        width: 800,
        height: 450,
      }),
    })

    if (!response.ok) {
      return null
    }

    const json = (await response.json()) as { success?: boolean; url?: string }
    if (!json || json.success !== true || !json.url) {
      return null
    }

    return json.url
  } catch {
    return null
  }
}

export const listProposals = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.auth!.userId
  const proposals = await Proposal.find({ userId }).populate("siteEvaluationId").sort({ createdAt: -1 })
  res.json({ success: true, data: proposals })
})

export const createProposal = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.auth!.userId
  const { title, siteEvaluationId, content } = req.body
  if (!title || !siteEvaluationId) {
    throw new ApiError(400, "Title and siteEvaluationId are required")
  }
  const proposal = await Proposal.create({
    userId,
    title,
    siteEvaluationId,
    content: content ?? {},
  })
  res.status(201).json({ success: true, data: proposal })
})

export const getProposal = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.auth!.userId
  const proposal = await Proposal.findOne({ _id: req.params.id, userId }).populate("siteEvaluationId")
  if (!proposal) throw new ApiError(404, "Proposal not found")
  res.json({ success: true, data: proposal })
})

export const updateProposal = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.auth!.userId
  const proposal = await Proposal.findOneAndUpdate(
    { _id: req.params.id, userId },
    { $set: req.body },
    { new: true, runValidators: true }
  )
  if (!proposal) throw new ApiError(404, "Proposal not found")
  res.json({ success: true, data: proposal })
})

export const recommendInfrastructure = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.auth!.userId
    const { siteId, area: areaInput, slope: slopeInput } = req.body as {
      siteId?: string
      area?: number
      slope?: number
    }

    if (!siteId) {
      throw new ApiError(400, "siteId is required")
    }

    const area = typeof areaInput === "number" && Number.isFinite(areaInput) ? areaInput : 0
    const slope = typeof slopeInput === "number" && Number.isFinite(slopeInput) ? slopeInput : 0

    const proposal = await createProposalFromRecommendation(userId, area, slope, { siteId })

    res.status(201).json({
      success: true,
      data: proposal,
    })
  }
)

export const saveInfrastructureProposal = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.auth!.userId
    const {
      siteId,
      infrastructureType,
      estimatedCost,
      roiMonths,
      suitabilityScore,
    } = req.body as {
      siteId?: string
      infrastructureType?: string
      estimatedCost?: number
      roiMonths?: number
      suitabilityScore?: number
    }

    if (!siteId) {
      throw new ApiError(400, "siteId is required")
    }

    const evaluation = await SiteEvaluation.findOne({
      _id: siteId,
      userId,
    })

    if (!evaluation) {
      throw new ApiError(404, "Site evaluation not found")
    }

    const title = `Infrastructure proposal for ${evaluation.name}`

    const proposal = await Proposal.create({
      userId,
      title,
      siteEvaluationId: evaluation._id,
      content: {
        infrastructureType,
        estimatedCost,
        roiMonths,
        suitabilityScore,
      },
      status: "draft",
    })

    res.status(201).json({
      success: true,
      data: {
        proposalId: proposal._id,
      },
    })
  }
)

export const getProposalsForSite = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.auth!.userId
    const { siteId } = req.params as { siteId?: string }

    if (!siteId) {
      throw new ApiError(400, "siteId is required")
    }

    const proposals = await Proposal.find({
      userId,
      siteEvaluationId: siteId,
    }).sort({ createdAt: -1 })

    const data = proposals.map((p) => {
      const content = (p.content ?? {}) as {
        infrastructureType?: string
        estimatedCost?: number
        roiMonths?: number
        suitabilityScore?: number
      }

      return {
        id: p._id,
        siteEvaluationId: p.siteEvaluationId,
        infrastructureType: content.infrastructureType ?? null,
        estimatedCost: content.estimatedCost ?? null,
        roiMonths: content.roiMonths ?? null,
        suitabilityScore: content.suitabilityScore ?? null,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      }
    })

    res.json({ success: true, data })
  }
)

export const getProposalsForFarm = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.auth!.userId
    const { farmId } = req.params as { farmId?: string }

    if (!farmId) {
      throw new ApiError(400, "farmId is required")
    }

    const sites = await SiteEvaluation.find({
      userId,
      farmId,
    }).select("_id")

    if (!sites.length) {
      return res.json({ success: true, data: [] })
    }

    const siteIds = sites.map((s) => s._id)

    const proposals = await Proposal.find({
      userId,
      siteEvaluationId: { $in: siteIds },
    }).sort({ createdAt: -1 })

    const data = proposals.map((p) => {
      const content = (p.content ?? {}) as {
        infrastructureType?: string
        estimatedCost?: number
        roiMonths?: number
        suitabilityScore?: number
      }

      return {
        id: p._id,
        siteEvaluationId: p.siteEvaluationId,
        infrastructureType: content.infrastructureType ?? null,
        estimatedCost: content.estimatedCost ?? null,
        roiMonths: content.roiMonths ?? null,
        suitabilityScore: content.suitabilityScore ?? null,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      }
    })

    res.json({ success: true, data })
  }
)

export const getProposalPdf = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.auth!.userId
  const evaluation = await SiteEvaluation.findOne({
    _id: req.params.id,
    userId,
  }).populate("farmId")

  if (!evaluation) {
    throw new ApiError(404, "Site evaluation not found")
  }

  if (evaluation.status !== "submitted") {
    throw new ApiError(400, "Proposal PDF is only available for submitted evaluations")
  }

  const farm: unknown = (evaluation as any).farmId
  const farmName =
    typeof farm === "object" && farm && "name" in farm ? (farm as { name?: string }).name ?? "N/A" : "N/A"

  // Use mm units to match the requested coordinates
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  // HEADER
  let y = 10
  try {
    const logoPath = path.join(__dirname, "..", "..", "public", "growteq-logo.png")
    if (fs.existsSync(logoPath)) {
      const imgData = fs.readFileSync(logoPath).toString("base64")
      const logoDataUrl = `data:image/png;base64,${imgData}`
      // Logo approx width 40, height 15 at (20, 10)
      doc.addImage(logoDataUrl, "PNG", 20, 10, 40, 15)
    }
  } catch {
    // Ignore logo errors
  }

  doc.setFontSize(12)
  doc.text("Growteq Agri Farms Pvt Ltd", 70, 18)
  doc.text("Farm Infrastructure Proposal", 70, 26)

  // Divider line
  doc.setLineWidth(0.5)
  doc.line(20, 32, pageWidth - 20, 32)

  y = 42

  const generatedAt = new Date().toLocaleString("en-IN")
  const evaluationId = String(evaluation._id)
  const slopeText =
    typeof evaluation.slope === "number" ? `${evaluation.slope.toFixed(1)} %` : "Not available"
  const terrainSuitability = "Suitable for planning"

  // SECTION 1: FARM INFORMATION
  doc.setFontSize(11)
  doc.text("1. Farm Information", 20, y)
  y += 8
  doc.setFontSize(10)
  doc.text(`Farm Name: ${farmName}`, 20, y); y += 6
  doc.text(`Evaluation ID: ${evaluationId}`, 20, y); y += 6
  doc.text(`Area: ${evaluation.area} acres`, 20, y); y += 6
  doc.text(`Generated Date: ${generatedAt}`, 20, y); y += 10

  // SECTION 2: LAND ANALYSIS
  doc.setFontSize(11)
  doc.text("2. Land Analysis", 20, y)
  y += 8
  doc.setFontSize(10)
  doc.text(`Area: ${evaluation.area} acres`, 20, y); y += 6
  doc.text(`Slope: ${slopeText}`, 20, y); y += 6
  doc.text(`Terrain Suitability: ${terrainSuitability}`, 20, y); y += 10

  // SECTION 3: RECOMMENDED INFRASTRUCTURE
  doc.setFontSize(11)
  doc.text("3. Recommended Infrastructure", 20, y)
  y += 8
  doc.setFontSize(10)
  const infraType = evaluation.infrastructureRecommendation ?? "Not specified"
  doc.text(`Infrastructure Type: ${infraType}`, 20, y); y += 6
  doc.text(
    "Recommended Use: Protected cultivation and optimized resource deployment.",
    20,
    y
  )
  y += 10

  // SECTION 4: COST ESTIMATION
  doc.setFontSize(11)
  doc.text("4. Cost Estimation", 20, y)
  y += 8
  doc.setFontSize(10)

  const tableX1 = 20
  const tableX2 = pageWidth - 20 - 60

  doc.text("Component", tableX1, y)
  doc.text("Cost", tableX2, y)
  y += 2
  doc.setLineWidth(0.2)
  doc.line(20, y, pageWidth - 20, y)
  y += 6

  const rows: Array<[string, string]> = [
    ["Polyhouse Structure", "₹8,50,000"],
    ["Irrigation System", "₹2,20,000"],
    ["Climate Control", "₹1,40,000"],
    ["Miscellaneous", "₹46,000"],
    ["Total Estimated Cost", "₹12,56,000"],
  ]

  const rowHeight = 6
  rows.forEach(([label, cost]) => {
    doc.text(label, tableX1, y)
    doc.text(cost, tableX2, y)
    y += rowHeight
  })

  // SECTION 5: SITE MAP (optional)
  const mapImageUrl = await fetchSiteMapSnapshotUrl(req, String(evaluation._id))
  if (mapImageUrl) {
    try {
      const imgRes = await fetch(mapImageUrl)
      if (imgRes.ok) {
        const arrayBuffer = await imgRes.arrayBuffer()
        const imgBase64 = Buffer.from(arrayBuffer).toString("base64")
        const contentType = imgRes.headers.get("content-type") ?? ""
        const isJpeg = contentType.includes("jpeg") || contentType.includes("jpg")
        const imageFormat = isJpeg ? "JPEG" : "PNG"
        const mimeType = isJpeg ? "image/jpeg" : "image/png"
        const dataUrl = `data:${mimeType};base64,${imgBase64}`

        // Leave a little spacing before the map section
        y += 8
        if (y > pageHeight - 80) {
          doc.addPage()
          y = 20
        }

        doc.setFontSize(11)
        doc.text("5. Site Map", 20, y)
        y += 8

        doc.setFontSize(10)
        doc.text("Static snapshot of the evaluated site boundary.", 20, y)
        y += 6

        const mapWidthMm = pageWidth - 40
        const mapHeightMm = mapWidthMm * 0.6

        if (y + mapHeightMm > pageHeight - 20) {
          doc.addPage()
          y = 20
        }

        doc.addImage(dataUrl, imageFormat as "PNG" | "JPEG", 20, y, mapWidthMm, mapHeightMm)
        y += mapHeightMm + 4
      }
    } catch {
      // If snapshot fetch fails, continue without the map image
    }
  }

  // FOOTER
  doc.setFontSize(9)
  doc.setTextColor(120)
  doc.text(
    "Generated by Growteq Farm Planning System",
    20,
    pageHeight - 14
  )
  doc.text("Growteq Agri Farms Pvt Ltd", 20, pageHeight - 6)

  const pdfBuffer = Buffer.from(doc.output("arraybuffer"))

  res.setHeader("Content-Type", "application/pdf")
  res.setHeader("Content-Disposition", `attachment; filename=proposal-${evaluation._id}.pdf`)
  res.send(pdfBuffer)
})
