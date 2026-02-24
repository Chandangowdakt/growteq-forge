import { Response } from "express"
import PDFDocument from "pdfkit"
import { Proposal } from "../models/Proposal"
import { SiteEvaluation } from "../models/SiteEvaluation"
import { ApiError } from "../utils/ApiError"
import { asyncHandler } from "../utils/asyncHandler"
import { AuthenticatedRequest } from "../middleware/auth"

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

  const doc = new PDFDocument({ size: "A4", margin: 50 })

  res.setHeader("Content-Type", "application/pdf")
  res.setHeader("Content-Disposition", `attachment; filename=proposal-${evaluation._id}.pdf`)

  doc.pipe(res)

  doc.fontSize(18).text("Growteq Farm Infrastructure Proposal", { align: "center" })
  doc.moveDown()

  doc.fontSize(12)
  doc.text(`Farm: ${farmName}`)
  doc.text(`Evaluation: ${evaluation.name}`)
  doc.text(`Area: ${evaluation.area} acres`)
  doc.text(`Infrastructure: ${evaluation.infrastructureRecommendation ?? "Not specified"}`)

  const cost = evaluation.costEstimate ?? 0
  const costFormatted = cost.toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  })
  doc.text(`Estimated Cost: ${costFormatted}`)

  const generatedAt = new Date().toLocaleString("en-IN")
  doc.text(`Generated: ${generatedAt}`)

  doc.end()
})
