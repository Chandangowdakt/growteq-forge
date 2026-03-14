"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const Farm_1 = require("./models/Farm");
const Site_1 = require("./models/Site");
const SiteEvaluation_1 = require("./models/SiteEvaluation");
const Proposal_1 = require("./models/Proposal");
const User_1 = require("./models/User");
const Notification_1 = require("./models/Notification");
dotenv_1.default.config();
async function seed() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.error("MONGODB_URI is not set");
        process.exit(1);
    }
    await mongoose_1.default.connect(uri);
    console.log("MongoDB connected for seeding");
    try {
        let user = await User_1.User.findOne({ email: "admin@growteq.com" });
        if (!user) {
            user = await User_1.User.create({
                email: "admin@growteq.com",
                password: "admin123",
                name: "Admin User",
                role: "admin",
            });
            console.log("Created admin user: admin@growteq.com / admin123");
        }
        else {
            console.log("Admin user already exists");
        }
        await Farm_1.Farm.deleteMany({ userId: user._id });
        await Site_1.Site.deleteMany({});
        await SiteEvaluation_1.SiteEvaluation.deleteMany({});
        await Proposal_1.Proposal.deleteMany({});
        await Notification_1.Notification.deleteMany({ userId: user._id });
        const farm1 = await Farm_1.Farm.create({
            name: "North Block Farm",
            location: "Karnataka",
            userId: user._id,
        });
        const farm2 = await Farm_1.Farm.create({
            name: "South Block Farm",
            location: "Karnataka",
            userId: user._id,
        });
        const site1 = await Site_1.Site.create({
            name: "Plot A",
            area: 5,
            perimeter: 300,
            slope: 2,
            farmId: farm1._id,
            geojson: { type: "Polygon", coordinates: [[[77.5, 12.9], [77.51, 12.9], [77.51, 12.91], [77.5, 12.91], [77.5, 12.9]]] },
        });
        const site2 = await Site_1.Site.create({
            name: "Plot B",
            area: 10,
            perimeter: 420,
            slope: 5,
            farmId: farm1._id,
            geojson: { type: "Polygon", coordinates: [[[77.52, 12.88], [77.53, 12.88], [77.53, 12.89], [77.52, 12.89], [77.52, 12.88]]] },
        });
        const site3 = await Site_1.Site.create({
            name: "Plot C",
            area: 15,
            perimeter: 500,
            slope: 8,
            farmId: farm2._id,
            geojson: { type: "Polygon", coordinates: [[[77.54, 12.87], [77.55, 12.87], [77.55, 12.88], [77.54, 12.88], [77.54, 12.87]]] },
        });
        const eval1 = await SiteEvaluation_1.SiteEvaluation.create({
            siteId: site1._id,
            farmId: farm1._id,
            userId: user._id,
            soilType: "Loam",
            waterAvailability: "Borewell",
            slopePercentage: 2,
            status: "submitted",
        });
        const eval2 = await SiteEvaluation_1.SiteEvaluation.create({
            siteId: site2._id,
            farmId: farm1._id,
            userId: user._id,
            soilType: "Clay",
            waterAvailability: "Canal",
            slopePercentage: 5,
            status: "submitted",
        });
        await Proposal_1.Proposal.create([
            {
                title: "Proposal Plot A",
                siteId: site1._id,
                siteEvaluationId: eval1._id,
                userId: user._id,
                content: { investment: 1250000, roiMonths: 18 },
                investmentValue: 1250000,
                roiMonths: 18,
                infrastructureType: "polyhouse",
                status: "recommended",
            },
            {
                title: "Proposal Plot B",
                siteId: site2._id,
                siteEvaluationId: eval2._id,
                userId: user._id,
                content: { investment: 350000, roiMonths: 6 },
                investmentValue: 350000,
                roiMonths: 6,
                infrastructureType: "shade_net",
                status: "recommended",
            },
            {
                title: "Proposal Plot C",
                siteId: site3._id,
                userId: user._id,
                content: { investment: 225000, roiMonths: 3 },
                investmentValue: 225000,
                roiMonths: 3,
                infrastructureType: "open_field",
                status: "recommended",
            },
        ]);
        await Notification_1.Notification.create([
            { userId: user._id, title: "Site evaluation submitted", message: "Plot A evaluation is ready for review.", type: "info", isRead: false },
            { userId: user._id, title: "Proposal approved", message: "Proposal for Plot B has been approved.", type: "success", isRead: false },
            { userId: user._id, title: "New boundary drawn", message: "A new boundary was added to North Block Farm.", type: "info", isRead: false },
        ]);
        console.log("Demo data inserted: 1 admin user, 2 farms, 3 sites, 3 proposals, 2 site evaluations, 3 notifications");
    }
    catch (err) {
        console.error("Seed error:", err);
        process.exit(1);
    }
    finally {
        await mongoose_1.default.disconnect();
    }
    process.exit(0);
}
seed();
