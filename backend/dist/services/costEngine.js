"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateCost = calculateCost;
const COST_PER_ACRE = {
    Polyhouse: 800000,
    "Shade Net": 400000,
    "Open Field": 150000,
};
const VALID_TYPES = ["Polyhouse", "Shade Net", "Open Field"];
function calculateCost(area, infrastructure) {
    if (area < 0) {
        throw new Error("Area must be >= 0");
    }
    if (!VALID_TYPES.includes(infrastructure)) {
        throw new Error(`Invalid infrastructure type: ${infrastructure}`);
    }
    return Math.round(area * COST_PER_ACRE[infrastructure]);
}
