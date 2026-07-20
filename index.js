import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import path from "path";
import { fileURLToPath } from "url";
import compression from "compression";

import User from "./models/User.js";
import Product from "./models/Product.js";
import Address from "./models/Address.js";
import Order from "./models/Order.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(compression());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Simple in-memory cache with TTL
const cache = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

const getCache = (key) => {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiry) {
    cache.delete(key);
    return null;
  }
  return item.data;
};

const setCache = (key, data) => {
  cache.set(key, { data, expiry: Date.now() + CACHE_TTL });
};

const clearCache = (pattern) => {
  for (const key of cache.keys()) {
    if (key.includes(pattern)) cache.delete(key);
  }
};

// Vercel-recommended CORS setup - MANUAL IMPLEMENTATION
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowed = [
    "https://client-ruddy-rho.vercel.app", 
    "https://indiangarment.vercel.app",
    "http://localhost:3000", 
    "http://localhost:5173"
  ];
  
  if (allowed.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else {
    // Default fallback to the primary live domain
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

// Apply to options explicitly
app.options("*", cors());

// ✅ CAPACITOR SPECIFIC ORIGIN FIX
app.use((req, res, next) => {
  if (req.headers.origin === "capacitor://localhost") {
    res.setHeader("Access-Control-Allow-Origin", "capacitor://localhost");
  }
  next();
});

app.options("*", cors());

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


// ✅ Auth
app.post("/api/register", async (req, res) => {
  try {
    const { name, username, email, password } = req.body;
    const finalName = name || username;
    if (!finalName || !email || !password) return res.status(400).json({ error: "All fields required" });
    const [existingUser, hashed] = await Promise.all([
      User.findOne({ email }),
      bcrypt.hash(password, 8)
    ]);
    if (existingUser) return res.status(409).json({ error: "Email already exists" });

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
app.get("/api/products", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const cacheKey = `products-page-${page}-limit-${limit}`;
    
    const cached = getCache(cacheKey);
    if (cached) return res.json(cached);
    
    const products = await Product.find()
      .select('_id name category price discountPrice img inStock ratings reviews')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
    
    // Optimize image URLs for faster loading
    const optimizedProducts = products.map(p => ({
      ...p,
      img: p.img ? p.img.replace('http://', 'https://') : 'https://via.placeholder.com/400x500?text=No+Image'
    }));
    
    const total = await Product.countDocuments();
    const response = { products: optimizedProducts, total, page, pages: Math.ceil(total / limit) };
    setCache(cacheKey, response);
    res.json(response);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ✅ Product Search
app.get("/api/products/search", async (req, res) => {
  try {
    const q = req.query.q || '';
    if (!q) return res.json({ products: [], total: 0 });
    
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const cacheKey = `products-search-${q}-page-${page}-limit-${limit}`;
    
    const cached = getCache(cacheKey);
    if (cached) return res.json(cached);
    
    const products = await Product.find({
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { category: { $regex: q, $options: 'i' } },
        { brand: { $regex: q, $options: 'i' } }
      ]
    })
      .select('_id name category price discountPrice img inStock ratings reviews')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
    
    const optimizedProducts = products.map(p => ({
      ...p,
      img: p.img ? p.img.replace('http://', 'https://') : 'https://via.placeholder.com/400x500?text=No+Image'
    }));
    
    const total = await Product.countDocuments({
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { category: { $regex: q, $options: 'i' } },
        { brand: { $regex: q, $options: 'i' } }
      ]
    });
    
    const response = { products: optimizedProducts, total, page, pages: Math.ceil(total / limit) };
    setCache(cacheKey, response);
    res.json(response);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/admin/products", protect, adminOnly, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    const cacheKey = `admin-products-page-${page}-limit-${limit}`;
    
    const cached = getCache(cacheKey);
    if (cached) return res.json(cached);
    
    const products = await Product.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
    
    const total = await Product.countDocuments();
    const response = { products, total, page, pages: Math.ceil(total / limit) };
    setCache(cacheKey, response);
    res.json(response);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/admin/products", protect, adminOnly, async (req, res) => {
  try {
    const product = await Product.create(req.body);
    clearCache('products');
    clearCache('admin-products');
    res.status(201).json(product);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put("/api/admin/products/:id", protect, adminOnly, async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
    clearCache('products');
    clearCache('admin-products');
    res.json(product);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete("/api/admin/products/:id", protect, adminOnly, async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    clearCache('products');
    clearCache('admin-products');
    res.json({ message: "Product deleted" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ✅ Addresses
app.get("/api/checkout/addresses/:email", async (req, res) => {
  try {
    const data = await Address.find({ userEmail: req.params.email }).sort({ createdAt: -1 }).lean();
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/checkout/addresses", async (req, res) => {
  try {
    const address = await Address.create(req.body);
    res.json(address);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ✅ Orders - GET
app.get("/api/checkout/orders/:email", async (req, res) => {
  try {
    const email = req.params.email || req.query.email;
    if (!email) return res.status(400).json({ error: "Email required" });
    const orders = await Order.find({ "user.email": email }).sort({ createdAt: -1 }).lean();
    res.json(orders);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ✅ Orders - CREATE
app.post("/api/checkout/create-order", async (req, res) => {
  try {
    const { user, items = [], shippingAddress, paymentMethod } = req.body;
    if (!items.length) return res.status(400).json({ error: "Cart is empty" });
    const processedItems = items.map(item => ({
      ...item,
      size: Array.isArray(item.size) ? (item.size[0] || "Standard") : (item.size || "Standard")
    }));

    const totalAmount = processedItems.reduce((sum, i) => sum + Number(i.price || 0), 0);
    const order = await Order.create({ 
      user, 
      items: processedItems, 
      shippingAddress, 
      totalAmount, 
      paymentMethod, 
      paymentStatus: "pending", 
      orderStatus: "pending" 
    });
    clearCache('admin-summary');
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
    const cached = getCache('admin-summary');
    if (cached) return res.json(cached);
    
    const [users, products, orders] = await Promise.all([
      User.countDocuments(), Product.countDocuments(), Order.countDocuments()
    ]);
    const revenue = await Order.aggregate([
      { $match: { orderStatus: "delivered" } },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } }
    ]);
    const summary = { users, products, orders, revenue: revenue[0]?.total || 0 };
    setCache('admin-summary', summary);
    res.json(summary);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/admin/users", protect, adminOnly, async (req, res) => {
  try { res.json(await User.find().select("-password").sort({ createdAt: -1 }).lean()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/admin/orders", protect, adminOnly, async (req, res) => {
  try { res.json(await Order.find().sort({ createdAt: -1 }).lean()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/admin/addresses", protect, adminOnly, async (req, res) => {
  try {
    const addresses = await Address.find().sort({ createdAt: -1 }).lean();
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
    clearCache('admin-summary');
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

mongoose.connect(process.env.MONGO_URI, {
  maxPoolSize: 50,
  minPoolSize: 5,
  socketTimeoutMS: 45000,
  serverSelectionTimeoutMS: 5000,
  connectTimeoutMS: 10000,
  retryWrites: true,
  w: 'majority'
})
  .then(() => {
    console.log("✅ MongoDB connected with optimized pool");
    app.listen(PORT, () => console.log(`🚀 Indian Garment server on port ${PORT}`));
  })
  .catch(err => { console.error("❌ DB connection failed:", err.message); process.exit(1); });
