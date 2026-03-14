"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectDb = connectDb;
exports.disconnectDb = disconnectDb;
const mongoose_1 = __importDefault(require("mongoose"));
async function connectDb() {
    const uri = process.env.MONGODB_URI;
    if (!uri)
        throw new Error("MONGODB_URI is not defined");
    await mongoose_1.default.connect(uri);
    console.log("MongoDB connected");
}
async function disconnectDb() {
    await mongoose_1.default.disconnect();
    console.log("[DB] MongoDB disconnected");
}
