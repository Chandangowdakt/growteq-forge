import { connectDb, disconnectDb } from "./config/db"
import { User } from "./models/User"
import { Farm } from "./models/Farm"
import { SiteEvaluation } from "./models/SiteEvaluation"
import { calculateCost } from "./services/costEngine"

async function seed() {
  await connectDb()

  try {
    const email = "demo@growteq.com"
    const password = "demo123"

    let user = await User.findOne({ email })

    if (!user) {
      user = new User({
        email,
        password,
        name: "Demo User",
        role: "admin",
      })
      await user.save()
      console.log(`[seed] Created demo user ${email}`)
    } else {
      console.log("[seed] Demo user already exists")
    }

    // Clear existing demo data for idempotence
    await Farm.deleteMany({ userId: user._id })
    await SiteEvaluation.deleteMany({ userId: user._id })

    const farm1 = await Farm.create({
      userId: user._id,
      name: "Green Valley Farm",
      description: "Mixed vegetable production with drip irrigation",
      location: "Hosahalli",
    })

    const farm2 = await Farm.create({
      userId: user._id,
      name: "Riverbend Orchard",
      description: "Fruit orchards near the river belt",
      location: "Mudugere",
    })

    const now = new Date()
    const oneMonthAgo = new Date(now)
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)
    const twoMonthsAgo = new Date(now)
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2)

    // Draft evaluations (area + boundary, no infra / cost)
    const draftBase = {
      userId: user._id,
      areaUnit: "acres" as const,
      status: "draft" as const,
    }

    const draftEvaluations = [
      {
        name: "Hosahalli North Block",
        farmId: farm1._id,
        area: 5,
        boundary: [
          { lat: 12.9, lng: 77.5, id: "p1" },
          { lat: 12.91, lng: 77.5, id: "p2" },
          { lat: 12.91, lng: 77.51, id: "p3" },
          { lat: 12.9, lng: 77.51, id: "p4" },
        ],
      },
      {
        name: "Riverbend East Plot",
        farmId: farm2._id,
        area: 3,
        boundary: [
          { lat: 12.8, lng: 77.6, id: "p1" },
          { lat: 12.81, lng: 77.6, id: "p2" },
          { lat: 12.81, lng: 77.61, id: "p3" },
          { lat: 12.8, lng: 77.61, id: "p4" },
        ],
      },
      {
        name: "Trial Open Field",
        farmId: farm1._id,
        area: 2,
        boundary: [
          { lat: 12.85, lng: 77.55, id: "p1" },
          { lat: 12.86, lng: 77.55, id: "p2" },
          { lat: 12.86, lng: 77.56, id: "p3" },
          { lat: 12.85, lng: 77.56, id: "p4" },
        ],
      },
    ]

    await SiteEvaluation.insertMany(
      draftEvaluations.map((e) => ({
        ...draftBase,
        ...e,
      }))
    )

    // Submitted evaluations with infrastructure + cost
    const submittedPolyhouseArea = 4
    const submittedShadeNetArea = 6

    const polyhouseCost = calculateCost(submittedPolyhouseArea, "Polyhouse")
    const shadeNetCost = calculateCost(submittedShadeNetArea, "Shade Net")

    const submittedEvaluations = [
      {
        name: "Polyhouse Block A",
        userId: user._id,
        farmId: farm1._id,
        boundary: [
          { lat: 12.92, lng: 77.52, id: "p1" },
          { lat: 12.93, lng: 77.52, id: "p2" },
          { lat: 12.93, lng: 77.53, id: "p3" },
          { lat: 12.92, lng: 77.53, id: "p4" },
        ],
        area: submittedPolyhouseArea,
        areaUnit: "acres" as const,
        slope: 3,
        infrastructureRecommendation: "Polyhouse",
        costEstimate: polyhouseCost,
        costCurrency: "INR",
        status: "submitted" as const,
        createdAt: twoMonthsAgo,
        updatedAt: twoMonthsAgo,
      },
      {
        name: "Shade Net South Block",
        userId: user._id,
        farmId: farm2._id,
        boundary: [
          { lat: 12.88, lng: 77.58, id: "p1" },
          { lat: 12.89, lng: 77.58, id: "p2" },
          { lat: 12.89, lng: 77.59, id: "p3" },
          { lat: 12.88, lng: 77.59, id: "p4" },
        ],
        area: submittedShadeNetArea,
        areaUnit: "acres" as const,
        slope: 5,
        infrastructureRecommendation: "Shade Net",
        costEstimate: shadeNetCost,
        costCurrency: "INR",
        status: "submitted" as const,
        createdAt: oneMonthAgo,
        updatedAt: oneMonthAgo,
      },
    ]

    await SiteEvaluation.insertMany(submittedEvaluations)

    const farmsCount = await Farm.countDocuments({ userId: user._id })
    const draftCount = await SiteEvaluation.countDocuments({
      userId: user._id,
      status: "draft",
    })
    const submittedCount = await SiteEvaluation.countDocuments({
      userId: user._id,
      status: "submitted",
    })
    const submittedForRevenue = await SiteEvaluation.find({
      userId: user._id,
      status: "submitted",
    })

    const totalRevenue = submittedForRevenue.reduce(
      (sum, e) => sum + (e.costEstimate ?? 0),
      0
    )

    console.log("[seed] Summary")
    console.log(`  Farms: ${farmsCount}`)
    console.log(`  Draft evaluations: ${draftCount}`)
    console.log(`  Submitted evaluations: ${submittedCount}`)
    console.log(`  Total revenue: ${totalRevenue}`)
  } catch (err) {
    console.error("[seed] Error seeding data:", err)
  } finally {
    await disconnectDb()
  }
}

seed().catch((err) => {
  console.error("[seed] Unhandled error:", err)
})

