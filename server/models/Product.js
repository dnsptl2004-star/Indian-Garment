import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: { type: String, default: "Menswear" },
    price: { type: Number, required: true, min: 0 },
    discountPrice: { type: Number, default: 0 },
    sku: { type: String, default: "" },
    img: { type: String, default: "https://via.placeholder.com/400x500" },
    description: { type: String, default: "" },
    size: [{ type: String }],
    brand: { type: String, default: "" },
    fabric: { type: String, default: "" },
    color: { type: String, default: "" },
    occasion: { type: String, default: "" },
    inStock: { type: Boolean, default: true },
    ratings: { type: Number, default: 0 },
    reviews: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.models.Product || mongoose.model("Product", productSchema);
