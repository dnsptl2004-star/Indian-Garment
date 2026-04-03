import mongoose from "mongoose";

const addressSchema = new mongoose.Schema(
  {
    userEmail: { type: String, required: true, index: true },
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    line1: { type: String, required: true },
    line2: { type: String, default: "" },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
    landmark: { type: String, default: "" },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.models.Address || mongoose.model("Address", addressSchema);







