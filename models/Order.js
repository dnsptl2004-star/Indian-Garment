import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    user: {
      name: String,
      email: String,
    },
    items: [
      {
        name: String,
        price: Number,
        img: String,
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
    },
    paymentMethod: String,
    paymentStatus: {
      type: String,
      default: "pending",
    },
    paymentReference: String,
    orderStatus: {
      type: String,
      default: "pending",
    },
    totalAmount: Number,
  },
  { timestamps: true }
);

export default mongoose.model("Order", orderSchema);