import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import User from "./models/User.js";
import Product from "./models/Product.js";
import Address from "./models/Address.js";
import Order from "./models/Order.js";
import adminRoutes from "./routes/adminRoutes.js";

dotenv.config();

const app = express();

// =========================
// ✅ CORS FIX (LOCAL + VERCEL)
// =========================
app.use(cors({
  origin: [
    "http://localhost:3000",
    "https://client-ruddy-rho.vercel.app"
  ],
  credentials: true
}));

app.use(express.json());

// =========================
// ✅ CONNECT MONGODB
// =========================
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// =========================
// ✅ JWT TOKEN
// =========================
const makeToken = (user) =>
  jwt.sign(
    {
      id: user._id,
      email: user.email,
      isAdmin: user.isAdmin,
    },
    process.env.JWT_SECRET || "secret123",
    { expiresIn: "7d" }
  );

// =========================
// ✅ AUTH MIDDLEWARE
// =========================
const protect = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "No token" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret123");
    req.user = decoded;

    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
};

// =========================
// ✅ ROOT
// =========================
app.get("/", (req, res) => {
  res.send("✅ Backend is LIVE");
});

app.get("/api/health", (_req, res) => res.json({ ok: true }));

// =========================
// ✅ REGISTER
// =========================
app.post("/api/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: "All fields required" });
    }

    const exists = await User.findOne({ email });
    if (exists) return res.status(409).json({ error: "Email exists" });

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      username,
      email,
      password: hashedPassword,
      isAdmin: false,
    });

    const token = makeToken(user);

    res.json({
      message: "✅ Registered",
      token,
      user
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =========================
// ✅ LOGIN
// =========================
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    const token = makeToken(user);

    res.json({
      message: "✅ Login successful",
      token,
      user
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =========================
// ✅ CURRENT USER
// =========================
app.get("/api/me", protect, async (req, res) => {
  const user = await User.findById(req.user.id);
  res.json({ user });
});

// =========================
// ✅ PRODUCTS
// =========================
app.get("/api/products", async (req, res) => {
  try {
    const { category, search } = req.query;
    const query = {};

    if (category && category !== "all") {
      query.category = { $regex: category, $options: "i" };
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const products = await Product.find(query).sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =========================
// ✅ ADD PRODUCT (ADMIN)
// =========================
app.post("/api/products", async (req, res) => {
  try {
    const product = await Product.create(req.body);
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =========================
// ✅ ADDRESS
// =========================
app.get("/api/checkout/addresses/:email", async (req, res) => {
  const data = await Address.find({ userEmail: req.params.email });
  res.json(data);
});

app.post("/api/checkout/addresses", async (req, res) => {
  const address = await Address.create(req.body);
  res.json(address);
});

// =========================
// ✅ ORDER
// =========================
app.post("/api/checkout/create-order", async (req, res) => {
  try {
    const { user, items, shippingAddress } = req.body;

    const totalAmount = items.reduce((sum, i) => sum + i.price, 0);

    const order = await Order.create({
      user,
      items,
      shippingAddress,
      totalAmount,
      paymentStatus: "pending",
      orderStatus: "pending",
    });

    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/checkout/orders/:email", async (req, res) => {
  const orders = await Order.find({ "user.email": req.params.email });
  res.json(orders);
});

// =========================
// ✅ ADMIN ROUTES
// =========================
app.use("/api/admin", adminRoutes);

// =========================
// ✅ SERVER START
// =========================
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});