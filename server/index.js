import express from "express";
import cors from "cors";
import mongoose from "mongoose";

const app = express();

// =========================
// ✅ MIDDLEWARE
// =========================
app.use(cors({ origin: "*" }));
app.use(express.json());

// =========================
// ✅ CONNECT MONGODB (SAFE)
// =========================
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB Connected");
  } catch (err) {
    console.error("❌ MongoDB Error:", err.message);
    process.exit(1);
  }
};

// =========================
// ✅ SCHEMAS
// =========================
const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  role: { type: String, default: "user" }
});

const productSchema = new mongoose.Schema({
  name: String,
  price: Number,
  category: String,
  img: String,
  description: String
});

const User = mongoose.model("User", userSchema);
const Product = mongoose.model("Product", productSchema);

// =========================
// ✅ ROOT ROUTE
// =========================
app.get("/", (req, res) => {
  res.send("✅ Backend is LIVE with DB");
});

// =========================
// ✅ PRODUCTS (GET ALL)
// =========================
app.get("/api/products", async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =========================
// ✅ ADMIN: ADD PRODUCT
// =========================
app.post("/api/admin/add-product", async (req, res) => {
  try {
    const product = new Product(req.body);
    await product.save();
    res.json({ message: "✅ Product added", product });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =========================
// ✅ ADMIN: DELETE PRODUCT
// =========================
app.delete("/api/admin/delete-product/:id", async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: "🗑 Product deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =========================
// ✅ REGISTER
// =========================
app.post("/api/register", async (req, res) => {
  const { email, password } = req.body;

  try {
    const exist = await User.findOne({ email });
    if (exist) {
      return res.status(400).json({ error: "User already exists" });
    }

    const newUser = new User({ email, password });
    await newUser.save();

    res.json({
      message: "✅ Registration successful",
      user: newUser
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =========================
// ✅ LOGIN
// =========================
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email, password });

    if (!user) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    res.json({
      message: "✅ Login successful",
      user
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =========================
// ✅ OPTIONAL GET (NO ERROR)
// =========================
app.get("/api/login", (req, res) => {
  res.send("⚠️ Use POST method for login");
});

app.get("/api/register", (req, res) => {
  res.send("⚠️ Use POST method for register");
});

// =========================
// ✅ START SERVER AFTER DB
// =========================
const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on ${PORT}`);
  });
});