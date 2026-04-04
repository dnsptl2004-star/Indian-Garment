import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    user: {
      name: String,
      email: String,
      phone: String,
    },
    items: [
      {
        product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
        name: String,
        price: Number,
        img: String,
        size: String,
        color: String,
        brand: String,
        count: { type: Number, default: 1 },
      },
    ],
    shippingAddress: {
      fullName: String,
      phone: String,
      line1: String,
      line2: String,
      city: String,
      state: String,
      pincode: String,
      landmark: String,
    },
    paymentMethod: { type: String, default: "upi" },
    paymentStatus: { type: String, default: "pending" },
    paymentReference: { type: String, default: "" },
    orderStatus: { type: String, default: "pending" },
    totalAmount: { type: Number, required: true },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

export default mongoose.models.Order || mongoose.model("Order", orderSchema);