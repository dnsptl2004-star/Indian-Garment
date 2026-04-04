import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import path from "path";
import { fileURLToPath } from "url";

import User from "./models/User.js";
import Product from "./models/Product.js";
import Address from "./models/Address.js";
import Order from "./models/Order.js";
import checkoutRoutes from "./routes/checkoutRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use((req, res, next) => {
  console.log(`📡 [${new Date().toISOString()}] ${req.method} ${req.path}`);
  res.header("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

const makeToken = (user) =>
  jwt.sign(
    { id: user._id, email: user.email, role: user.role },
    process.env.JWT_SECRET || "secret123",
    { expiresIn: "7d" }
  );

const protect = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "No token" });
    req.user = jwt.verify(token, process.env.JWT_SECRET || "secret123");
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user?.role !== "admin") return res.status(403).json({ error: "Admin only" });
  next();
};

app.get("/", (_req, res) => res.send("✅ Backend is LIVE"));
app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.get("/api/ping", (_req, res) => res.json({ message: "pong", time: new Date() }));

app.post("/api/register", async (req, res) => {
  try {
    const { name, username, email, password } = req.body;
    const finalName = name || username;
    if (!finalName || !email || !password) return res.status(400).json({ error: "All fields required" });
    const exists = await User.findOne({ email });
    if (exists) return res.status(409).json({ error: "Email exists" });
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ name: finalName, email, password: hashedPassword, role: "user" });
    res.json({ message: "Registered", token: makeToken(user), user });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });
    res.json({ message: "Login success", token: makeToken(user), user });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/me", protect, async (req, res) => {
  const user = await User.findById(req.user.id).select("-password");
  res.json({ user });
});

app.get("/api/products", async (_req, res) => {
  const products = await Product.find().sort({ createdAt: -1 });
  res.json(products);
});

// Inline Checkout for absolute path reliability
app.post("/api/checkout/create-order", async (req, res) => {
  try {
    const { user, items = [], shippingAddress, paymentMethod } = req.body;
    const totalAmount = items.reduce((sum, i) => sum + Number(i.price || 0), 0);
    const order = await Order.create({ user, items, shippingAddress, totalAmount, paymentMethod });
    res.json(order);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/checkout/orders/:email?", async (req, res) => {
  try {
    const email = req.params.email || req.query.email;
    const orders = await Order.find({ "user.email": email }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Fallback Routes for Proxy Compatibility
app.get("/checkout/orders/:email?", async (req, res) => {
  const email = req.params.email || req.query.email;
  const orders = await Order.find({ "user.email": email }).sort({ createdAt: -1 });
  res.json(orders);
});

app.use("/api/checkout", checkoutRoutes);
app.use("/api/admin", protect, adminOnly, adminRoutes);

app.use((req, res) => {
  console.log(`🚨 404 Route Not Found: ${req.method} ${req.path}`);
  res.status(404).json({ error: "Route not found", method: req.method, path: req.path });
});

const PORT = process.env.PORT || 5000;
async function startServer() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB connected");
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  } catch (err) { console.error("❌ DB ERROR:", err.message); process.exit(1); }
}
startServer();