import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";
import { PRODUCT_CATEGORIES } from "@motatto/shared";
import { applyToJSON, tenantIdField } from "./base.js";

const PhotoSchema = new Schema(
  {
    url: { type: String, required: true },
    source: { type: String, enum: ["label", "shelf", "other"], default: "other" },
    at: { type: Date, default: () => new Date() },
  },
  { _id: false },
);

const ProductSchema = new Schema(
  {
    tenantId: tenantIdField,
    name: { type: String, required: true },
    reference: { type: String, default: "" },
    barcode: { type: String, default: "" },
    brand: { type: String, default: "" },
    category: { type: String, enum: PRODUCT_CATEGORIES, default: "otro" },
    compatibleWith: { type: [String], default: [] },
    cost: { type: Number, default: 0 },
    price: { type: Number, required: true },
    stock: { type: Number, default: 0 },
    minStock: { type: Number, default: 1 },
    location: { type: String, default: "" },
    photos: { type: [PhotoSchema], default: [] },
    active: { type: Boolean, default: true },
    lastLabelOcr: {
      type: new Schema({ raw: String, parsed: Schema.Types.Mixed, at: Date }, { _id: false }),
      required: false,
    },
  },
  { timestamps: true },
);
ProductSchema.index({ tenantId: 1, barcode: 1 });
ProductSchema.index({ tenantId: 1, reference: 1 });
ProductSchema.index({ tenantId: 1, active: 1, name: 1 });
ProductSchema.index({ name: "text", reference: "text", brand: "text", compatibleWith: "text" });
applyToJSON(ProductSchema);

export type ProductDoc = HydratedDocument<InferSchemaType<typeof ProductSchema>>;
export const Product = model("Product", ProductSchema);
