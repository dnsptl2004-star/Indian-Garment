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
import adminRoutes from "./routes/adminRoutes.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use(cors({
  origin: ["http://localhost:3000", "http://localhost:5173", "https://client-ruddy-rho.vercel.app"],
  credentials: true
}));

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

app.post("/api/register", async (req, res) => {
  try {
    const { name, username, email, password } = req.body;
    const finalName = name || username;

    if (!finalName || !email || !password) {
      return res.status(400).json({ error: "All fields required" });
    }

    const exists = await User.findOne({ email });
    if (exists) return res.status(409).json({ error: "Email exists" });

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name: finalName,
      email,
      password: hashedPassword,
      role: "user",
    });

    res.json({ message: "Registered", token: makeToken(user), user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    res.json({
      message: "Login successful",
      token: makeToken(user),
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/me", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/products", async (_req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/products", protect, adminOnly, async (req, res) => {
  try {
    const product = await Product.create(req.body);
    res.status(201).json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/checkout/addresses/:email", async (req, res) => {
  try {
    const data = await Address.find({ userEmail: req.params.email }).sort({ createdAt: -1 });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/checkout/addresses", async (req, res) => {
  try {
    const address = await Address.create(req.body);
    res.json(address);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/checkout/create-order", async (req, res) => {
  try {
    const { user, items = [], shippingAddress } = req.body;

    if (!items.length) return res.status(400).json({ error: "Cart is empty" });

    const totalAmount = items.reduce((sum, i) => sum + Number(i.price || 0), 0);

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

app.get("/api/checkout/orders/:email", protect, async (req, res) => {
  try {
    const orders = await Order.find({ "user.email": req.params.email }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/checkout/orders/:id", protect, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    const orderEmail = order.user?.email?.toLowerCase();
    const requesterEmail = req.user?.email?.toLowerCase();

    if (!orderEmail) {
      return res.status(400).json({ error: "Order user data incomplete" });
    }

    if (orderEmail !== requesterEmail && req.user.role !== "admin") {
      return res.status(403).json({ error: "Not authorized for this order" });
    }

    if (order.orderStatus === "delivered") {
      return res.status(400).json({ error: "Delivered orders cannot be cancelled" });
    }

    if (order.orderStatus === "cancelled") {
      return res.status(400).json({ error: "Order already cancelled" });
    }

    order.orderStatus = "cancelled";
    order.paymentStatus = "cancelled";

    await order.save();

    res.json({ message: "Order cancelled successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch("/api/admin/orders/:id/status", protect, adminOnly, async (req, res) => {
  try {
    const { paymentStatus, orderStatus } = req.body;

    const updateData = {};
    if (paymentStatus !== undefined) updateData.paymentStatus = paymentStatus;
    if (orderStatus !== undefined) updateData.orderStatus = orderStatus;

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.use("/api/admin", protect, adminOnly, adminRoutes);

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    if (!process.env.MONGO_URI) throw new Error("MONGO_URI missing");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB connected");
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  } catch (err) {
    console.error("❌ DB ERROR:", err.message);
    process.exit(1);
  }
}

startServer();
