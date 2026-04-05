import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import path from "path";
import { fileURLToPath } from "url";

import User from "./models/User.js";
import Product from "./models/Product.js";
import Address from "./models/Address.js";
import Order from "./models/Order.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// Vercel-recommended CORS setup - MANUAL IMPLEMENTATION
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowed = [
    "https://client-ruddy-rho.vercel.app", 
    "http://localhost:3000", 
    "http://localhost:5173"
  ];
  
  if (allowed.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else {
    res.setHeader("Access-Control-Allow-Origin", "https://client-ruddy-rho.vercel.app");
  }

  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept, Origin");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  
  next();
});

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const JWT_SECRET = process.env.JWT_SECRET || "secret123";

const makeToken = (user) =>
  jwt.sign({ id: user._id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: "7d" });

const protect = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "No token" });
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user?.role !== "admin") return res.status(403).json({ error: "Admin only" });
  next();
};

// ✅ Health
app.get("/", (_req, res) => res.send("✅ Indian Garment Backend LIVE"));
app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.get("/api/ping", (_req, res) => res.json({ message: "pong", time: new Date() }));

// ✅ Auth
app.post("/api/register", async (req, res) => {
  try {
    const { name, username, email, password } = req.body;
    const finalName = name || username;
    if (!finalName || !email || !password) return res.status(400).json({ error: "All fields required" });
    if (await User.findOne({ email })) return res.status(409).json({ error: "Email already exists" });
    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ name: finalName, email, password: hashed, role: "user" });
    res.json({ message: "Registered", token: makeToken(user), user: { _id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(401).json({ error: "Invalid credentials" });
    res.json({ message: "Login successful", token: makeToken(user), user: { _id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ✅ Products
app.get("/api/products", async (_req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/admin/products", protect, adminOnly, async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/admin/products", protect, adminOnly, async (req, res) => {
  try {
    const product = await Product.create(req.body);
    res.status(201).json(product);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put("/api/admin/products/:id", protect, adminOnly, async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(product);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete("/api/admin/products/:id", protect, adminOnly, async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: "Product deleted" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ✅ Addresses
app.get("/api/checkout/addresses/:email", async (req, res) => {
  try {
    const data = await Address.find({ userEmail: req.params.email }).sort({ createdAt: -1 });
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/checkout/addresses", async (req, res) => {
  try {
    const address = await Address.create(req.body);
    res.json(address);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ✅ Orders - GET (supports both path and query param)
app.get("/api/checkout/orders/:email", async (req, res) => {
  try {
    const email = req.params.email || req.query.email;
    if (!email) return res.status(400).json({ error: "Email required" });
    const orders = await Order.find({ "user.email": email }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ✅ Orders - CREATE
app.post("/api/checkout/create-order", async (req, res) => {
  try {
    const { user, items = [], shippingAddress, paymentMethod } = req.body;
    if (!items.length) return res.status(400).json({ error: "Cart is empty" });
    const totalAmount = items.reduce((sum, i) => sum + Number(i.price || 0), 0);
    const order = await Order.create({ user, items, shippingAddress, totalAmount, paymentMethod, paymentStatus: "pending", orderStatus: "pending" });
    const upiUrl = paymentMethod === "upi"
      ? `upi://pay?pa=indiangarment@upi&pn=IndianGarment&am=${totalAmount}&cu=INR`
      : null;
    res.json({ ...order.toObject(), upiUrl });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ✅ Orders - CONFIRM UPI
app.post("/api/checkout/confirm-upi", async (req, res) => {
  try {
    const { orderId, paymentReference } = req.body;
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ error: "Order not found" });
    order.paymentStatus = "paid";
    order.paymentReference = paymentReference;
    order.orderStatus = "confirmed";
    await order.save();
    res.json({ message: "Payment confirmed" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ✅ Orders - CANCEL
app.delete("/api/checkout/orders/:id", async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found" });
    if (order.orderStatus === "delivered") return res.status(400).json({ error: "Delivered orders cannot be cancelled" });
    if (order.orderStatus === "cancelled") return res.status(400).json({ error: "Order already cancelled" });
    order.orderStatus = "cancelled";
    order.paymentStatus = "cancelled";
    await order.save();
    res.json({ message: "Order cancelled successfully" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ✅ Admin routes - inline
app.get("/api/admin/summary", protect, adminOnly, async (req, res) => {
  try {
    const [users, products, orders] = await Promise.all([
      User.countDocuments(),
      Product.countDocuments(),
      Order.countDocuments()
    ]);
    const revenue = await Order.aggregate([
      { $match: { orderStatus: "delivered" } },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } }
    ]);
    res.json({ users, products, orders, revenue: revenue[0]?.total || 0 });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/admin/users", protect, adminOnly, async (req, res) => {
  try {
    const users = await User.find().select("-password").sort({ createdAt: -1 });
    res.json(users);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.patch("/api/admin/users/:id/role", protect, adminOnly, async (req, res) => {
  try {
    const { role } = req.body;
    if (!["user", "admin"].includes(role)) return res.status(400).json({ error: "Invalid role" });
    const user = await User.findByIdAndUpdate(req.params.id, { $set: { role } }, { new: true });
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/admin/products", protect, adminOnly, async (req, res) => {
  try { res.json(await Product.find().sort({ createdAt: -1 })); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/admin/orders", protect, adminOnly, async (req, res) => {
  try { res.json(await Order.find().sort({ createdAt: -1 })); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/admin/addresses", protect, adminOnly, async (req, res) => {
  try {
    const addresses = await Address.find().sort({ createdAt: -1 });
    res.json(addresses || []);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.patch("/api/admin/orders/:id/status", protect, adminOnly, async (req, res) => {
  try {
    const { paymentStatus, orderStatus } = req.body;
    const update = {};
    if (paymentStatus !== undefined) update.paymentStatus = paymentStatus;
    if (orderStatus !== undefined) update.orderStatus = orderStatus;
    const order = await Order.findByIdAndUpdate(req.params.id, { $set: update }, { new: true });
    if (!order) return res.status(404).json({ error: "Order not found" });
    res.json(order);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ✅ 404 catch-all
app.use((req, res) => {
  console.log(`❌ 404: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ 
    error: "Route not found", 
    method: req.method,
    path: req.path,
    fullUrl: req.originalUrl 
  });
});

const PORT = process.env.PORT || 5000;
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB connected");
    app.listen(PORT, () => console.log(`🚀 Indian Garment server on port ${PORT}`));
  })
  .catch(err => { console.error("❌ DB connection failed:", err.message); process.exit(1); });