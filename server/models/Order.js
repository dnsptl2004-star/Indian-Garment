import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    name: String,
    price: Number,
    qty: { type: Number, default: 1 },
    img: String,
    category: String,
  },
  { _id: false }
);

const shippingAddressSchema = new mongoose.Schema(
  {
    fullName: String,
    phone: String,
    line1: String,
    line2: String,
    city: String,
    state: String,
    pincode: String,
    landmark: String,
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    user: {
      username: String,
      email: String,
    },
    items: [orderItemSchema],
    shippingAddress: shippingAddressSchema,
    paymentMethod: {
      type: String,
      enum: ["upi", "cod"],
      default: "upi",
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "cancelled"],
      default: "pending",
    },
    orderStatus: {
      type: String,
      enum: ["pending", "confirmed", "shipped", "delivered", "cancelled"],
      default: "pending",
    },
    totalAmount: { type: Number, required: true },
    paymentReference: { type: String, default: "" },
    merchantUpiUrl: { type: String, default: "" },
  },
  { timestamps: true }
);

export default mongoose.models.Order || mongoose.model("Order", orderSchema);







