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
import checkoutRoutes from "./routes/checkout.js";

app.use("/api/checkout", checkoutRoutes);

dotenv.config();

const app = express();

app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://localhost:5173",
      "https://client-ruddy-rho.vercel.app",
    ],
    credentials: true,
  })
);

app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || "secret123";

const makeToken = (user) =>
  jwt.sign(
    {
      id: user._id,
      email: user.email,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );

const protect = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : null;

    if (!token) {
      return res.status(401).json({ error: "No token" });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Admin only" });
  }
  next();
};

app.get("/", (_req, res) => {
  res.send("✅ Backend is LIVE");
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/register", async (req, res) => {
  try {
    const { name, username, email, password } = req.body;
    const finalName = name || username;

    if (!finalName || !email || !password) {
      return res.status(400).json({ error: "All fields required" });
    }

    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(409).json({ error: "Email exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name: finalName,
      email,
      password: hashedPassword,
      role: "user",
    });

    const token = makeToken(user);

    res.status(201).json({
      message: "Registered",
      token,
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

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = makeToken(user);

    res.json({
      message: "Login successful",
      token,
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
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
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
    const data = await Address.find({ userEmail: req.params.email }).sort({
      createdAt: -1,
    });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/checkout/addresses", async (req, res) => {
  try {
    const address = await Address.create(req.body);
    res.status(201).json(address);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/checkout/create-order", async (req, res) => {
  try {
    const { user, items = [], shippingAddress, paymentMethod = "upi" } = req.body;

    if (!user?.email) {
      return res.status(400).json({ error: "User is required" });
    }

    if (!items.length) {
      return res.status(400).json({ error: "Cart is empty" });
    }

    if (
      !shippingAddress?.fullName ||
      !shippingAddress?.phone ||
      !shippingAddress?.line1 ||
      !shippingAddress?.city ||
      !shippingAddress?.state ||
      !shippingAddress?.pincode
    ) {
      return res.status(400).json({ error: "Shipping address is incomplete" });
    }

    const totalAmount = items.reduce((sum, i) => {
      const price = Number(i.price || 0);
      const qty = Number(i.qty || 1);
      return sum + price * qty;
    }, 0);

    const order = await Order.create({
      user,
      items,
      shippingAddress,
      paymentMethod,
      totalAmount,
      paymentStatus: "pending",
      orderStatus: "pending",
    });

    res.status(201).json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/checkout/orders/:email", protect, async (req, res) => {
  try {
    const orders = await Order.find({ "user.email": req.params.email }).sort({
      createdAt: -1,
    });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch("/api/admin/orders/:id/status", protect, adminOnly, async (req, res) => {
  try {
    const { paymentStatus, orderStatus } = req.body;

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { paymentStatus, orderStatus },
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
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI missing");
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB connected");

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error("❌ DB ERROR:", err.message);
    process.exit(1);
  }
}

startServer();