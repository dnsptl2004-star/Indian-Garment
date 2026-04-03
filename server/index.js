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
// ✅ CORS
// =========================
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "https://client-ruddy-rho.vercel.app",
    ],
    credentials: true,
  })
);

app.use(express.json());

// =========================
// ✅ JWT TOKEN
// =========================
const makeToken = (user) =>
  jwt.sign(
    {
      id: user._id,
      email: user.email,
      isAdmin: user.isAdmin, // ✅ use only this
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

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "secret123"
    );

    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
};

// =========================
// ✅ ADMIN MIDDLEWARE
// =========================
const adminOnly = (req, res, next) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ error: "Admin only access" });
  }
  next();
};

// =========================
// ✅ ROOT
// =========================
app.get("/", (req, res) => {
  res.send("✅ Backend is LIVE");
});

// =========================
// ✅ REGISTER
// =========================
app.post("/api/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;

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

    res.json({ token, user });
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
      token,
      user, // ✅ includes isAdmin
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
// ✅ PRODUCTS (PUBLIC)
// =========================
app.get("/api/products", async (req, res) => {
  const products = await Product.find().sort({ createdAt: -1 });
  res.json(products);
});

// =========================
// ✅ PRODUCTS (ADMIN ONLY)
// =========================
app.post("/api/products", protect, adminOnly, async (req, res) => {
  const product = await Product.create(req.body);
  res.json(product);
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
});

app.get("/api/checkout/orders/:email", async (req, res) => {
  const orders = await Order.find({
    "user.email": req.params.email,
  });
  res.json(orders);
});

// =========================
// ✅ ADMIN ROUTES (PROTECTED)
// =========================
app.use("/api/admin", protect, adminOnly, adminRoutes);

// =========================
// ✅ START SERVER
// =========================
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB connected");

    app.listen(PORT, () => {
      console.log(`🚀 Server running on ${PORT}`);
    });
  } catch (err) {
    console.error("❌ DB ERROR:", err.message);
    process.exit(1);
  }
};

startServer();