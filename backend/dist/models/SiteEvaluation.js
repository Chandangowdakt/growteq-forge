"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SiteEvaluation = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const siteEvaluationSchema = new mongoose_1.Schema({
    siteId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Site", required: true },
    farmId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Farm", required: true },
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true },
    soilType: { type: String, required: true, trim: true },
    waterAvailability: { type: String, required: true, trim: true },
    slopePercentage: { type: Number, required: true, min: 0 },
    elevationMeters: { type: Number, min: 0 },
    sunExposure: { type: String, enum: ["full", "partial", "shade"], default: "full" },
    status: { type: String, enum: ["draft", "submitted", "approved", "rejected"], default: "draft" },
    notes: { type: String, trim: true },
    name: { type: String, trim: true },
    area: { type: Number, min: 0 },
    slope: { type: Number, min: 0 },
    areaUnit: { type: String, trim: true },
    infrastructureRecommendation: { type: String, trim: true },
}, { timestamps: true });
exports.SiteEvaluation = mongoose_1.default.model("SiteEvaluation", siteEvaluationSchema);
