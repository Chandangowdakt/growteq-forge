import mongoose, { Document, Schema } from "mongoose"

/** Singleton doc: bump when global infrastructure settings are saved (for evaluation snapshots). */
export type IInfraConfigMeta = Document & {
  _id: string
  version: number
}

const infraConfigMetaSchema = new Schema<IInfraConfigMeta>({
  _id: { type: String, required: true },
  version: { type: Number, default: 1, min: 1 },
})

export const InfraConfigMeta = mongoose.model<IInfraConfigMeta>("InfraConfigMeta", infraConfigMetaSchema)

export const INFRA_CONFIG_VERSION_ID = "singleton"
