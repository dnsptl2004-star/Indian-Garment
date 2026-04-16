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

// Optimized CORS setup
app.use((req, res, next) => {
  const origin = req.headers.origin;
  res.setHeader("Access-Control-Allow-Origin", origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  
  next();
});

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Health check endpoint for keep-alive monitoring
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// Cache middleware for static responses
const cacheMiddleware = (duration) => {
  return (req, res, next) => {
    res.set('Cache-Control', `public, max-age=${duration}`);
    next();
  };
};

const JWT_SECRET = process.env.JWT_SECRET || "secret123";

// Simple in-memory cache for user sessions (email -> user data + timestamp)
const userCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Token cache to avoid repeated JWT verification
const tokenCache = new Map();
const TOKEN_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

const getCachedUser = (email) => {
  const cached = userCache.get(email);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.user;
  }
  userCache.delete(email);
  return null;
};

const setCachedUser = (email, user) => {
  userCache.set(email, { user, timestamp: Date.now() });
};

const getCachedToken = (token) => {
  const cached = tokenCache.get(token);
  if (cached && Date.now() - cached.timestamp < TOKEN_CACHE_TTL) {
    return cached.user;
  }
  tokenCache.delete(token);
  return null;
};

const setCachedToken = (token, user) => {
  tokenCache.set(token, { user, timestamp: Date.now() });
};

const makeToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: "7d" });

const protect = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "No token" });
    
    // Check cache first
    const cachedUser = getCachedToken(token);
    if (cachedUser) {
      req.user = cachedUser;
      return next();
    }
    
    req.user = jwt.verify(token, JWT_SECRET);
    setCachedToken(token, req.user);
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user?.role !== "admin") return res.status(403).json({ error: "Admin only" });
  next();
};


// ✅ Auth
app.post("/api/register", async (req, res) => {
  try {
    const { name, username, email, password } = req.body;
    const finalName = name || username;
    if (!finalName || !email || !password) return res.status(400).json({ error: "All fields required" });
    
    // Check cache first for existing user
    const cachedExisting = getCachedUser(email);
    if (cachedExisting) return res.status(409).json({ error: "Email already exists" });
    
    const [existingUser, hashed] = await Promise.all([
      User.findOne({ email }).lean(),
      bcrypt.hash(password, 4)
    ]);
    if (existingUser) {
      setCachedUser(email, existingUser);
      return res.status(409).json({ error: "Email already exists" });
    }

    const user = await User.create({ name: finalName, email, password: hashed, role: "user" });
    res.json({ message: "Registered", token: makeToken(user), user: { _id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/login", async (req, res) => {
  const startTime = Date.now();
  try {
    const { email, password } = req.body;
    
    // Check cache first for recent successful logins
    const cacheStart = Date.now();
    const cachedUser = getCachedUser(email);
    const cacheTime = Date.now() - cacheStart;
    
    if (cachedUser) {
      const bcryptStart = Date.now();
      const isMatch = await bcrypt.compare(password, cachedUser.password);
      const bcryptTime = Date.now() - bcryptStart;
      if (isMatch) {
        const totalTime = Date.now() - startTime;
        return res.json({ 
          message: "Login successful", 
          token: makeToken(cachedUser), 
          user: { _id: cachedUser._id, name: cachedUser.name, email: cachedUser.email, role: cachedUser.role },
          timing: { cache: cacheTime, bcrypt: bcryptTime, total: totalTime }
        });
      }
    }
    
    const dbStart = Date.now();
    const user = await User.findOne({ email })
      .select('_id name email password role')
      .hint({ email: 1 })
      .lean()
      .maxTimeMS(5000);
    const dbTime = Date.now() - dbStart;
    
    if (!user) return res.status(401).json({ error: "Invalid credentials" });
    
    const bcryptStart = Date.now();
    const isMatch = await bcrypt.compare(password, user.password);
    const bcryptTime = Date.now() - bcryptStart;
    
    if (!isMatch) return res.status(401).json({ error: "Invalid credentials" });
    
    // Cache successful login
    setCachedUser(email, user);
    
    const totalTime = Date.now() - startTime;
    res.json({ 
      message: "Login successful", 
      token: makeToken(user), 
      user: { _id: user._id, name: user.name, email: user.email, role: user.role },
      timing: { cache: cacheTime, db: dbTime, bcrypt: bcryptTime, total: totalTime }
    });
  } catch (err) { 
    const totalTime = Date.now() - startTime;
    res.status(500).json({ error: err.message, timing: { total: totalTime } }); 
  }
});

// ✅ Products
app.get("/api/products", cacheMiddleware(300), async (_req, res) => {
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

// Cache database connection for serverless platforms
let cachedDb = null;

async function connectToDatabase() {
  if (cachedDb) {
    return cachedDb;
  }
  
  const opts = {
    maxPoolSize: 10,
    minPoolSize: 2,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  };
  
  cachedDb = await mongoose.connect(process.env.MONGO_URI, opts);
  return cachedDb;
}

// Keep-alive ping to prevent cold starts on serverless platforms
setInterval(() => {
  if (mongoose.connection.readyState === 1) {
    mongoose.connection.db.admin().ping().catch(() => {});
  }
}, 300000); // Ping every 5 minutes

connectToDatabase()
  .then(() => {
    app.listen(PORT, () => console.log(`🚀 Indian Garment server on port ${PORT}`));
  })
  .catch(err => { console.error("❌ DB connection failed:", err.message); process.exit(1); });