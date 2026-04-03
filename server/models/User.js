import mongoose from "mongoose";
import bcrypt from "bcryptjs";

// -------------------- User Schema --------------------
const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: 2,
      maxlength: 50,
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please use a valid email"],
    },

    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: 6,
    },

    isAdmin: {
      type: Boolean,
      default: false,
    },

    phone: {
      type: String,
      default: "",
    },

    // Saved addresses (optional for quick checkout)
    addresses: [
      {
        fullName: String,
        phone: String,
        line1: String,
        line2: String,
        city: String,
        state: String,
        pincode: String,
        country: {
          type: String,
          default: "India",
        },
        isDefault: {
          type: Boolean,
          default: false,
        },
      },
    ],
  },
  { timestamps: true }
);


// -------------------- Password Hash --------------------
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});


// -------------------- Password Compare --------------------
userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};


// -------------------- Export --------------------
const User = mongoose.model("User", userSchema);
export default User;







