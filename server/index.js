import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";


import User from "./models/User.js";
import Product from "./models/Product.js";
import Address from "./models/Address.js";
import Order from "./models/Order.js";
import adminRoutes from "./routes/adminRoutes.js";
import {  } from "./middleware/auth.js";

dotenv.config();

const app = express();
app.use(cors({ origin: "http://localhost:3000", credentials: true }));
app.use(express.json());

mongoose
  .connect(process.env.MONGO_URI || "mongodb+srv://Dhruv:Dhruv123@cluster0.ddark6d.mongodb.net/indian_garment?retryWrites=true&w=majority")
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

const makeToken = (user) =>
  "";

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.post("/api/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const exists = await User.findOne({ email });
    if (exists) return res.status(409).json({ error: "Email already registered" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      username,
      email,
      password: hashedPassword,
      isAdmin: false,
    });

    const token = makeToken(user);

    res.json({
      message: "✅ User registered successfully",
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        isAdmin: user.isAdmin,
      },
    });
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

    const token = makeToken(user);

    res.json({
      message: "✅ Login successful",
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        isAdmin: user.isAdmin,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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
        { category: { $regex: search, $options: "i" } },
      ];
    }

    const products = await Product.find(query).sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/products", async (req, res) => {
  try {
    const product = await Product.create({ name: req.body.name || "Default Product", price: req.body.price || 999, img: req.body.img || "", description: req.body.description || "No description", category: req.body.category || "general", inStock: true });
    res.json({ message: "✅ Product inserted", product });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/checkout/addresses/:email", async (req, res) => {
  try {
    const addresses = await Address.find({ userEmail: req.params.email }).sort({
      createdAt: -1,
    });
    res.json(addresses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/checkout/addresses", async (req, res) => {
  try {
    const {
      userEmail,
      fullName,
      phone,
      line1,
      line2,
      city,
      state,
      pincode,
      landmark,
      isDefault,
    } = req.body;

    if (!userEmail || !fullName || !phone || !line1 || !city || !state || !pincode) {
      return res.status(400).json({ error: "Fill all required address fields." });
    }

    if (isDefault) {
      await Address.updateMany({ userEmail }, { $set: { isDefault: false } });
    }

    const address = await Address.create({
      userEmail,
      fullName,
      phone,
      line1,
      line2,
      city,
      state,
      pincode,
      landmark,
      isDefault: !!isDefault,
    });

    res.json({ message: "Address saved", address });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

function buildUpiUrl({ amount, orderId }) {
  const storeName = process.env.STORE_NAME || "Royal Thread";
  const merchantUpi = process.env.MERCHANT_UPI_ID || "yourupiid@bank";

  const params = new URLSearchParams({
    pa: merchantUpi,
    pn: storeName,
    am: Number(amount).toFixed(2),
    cu: "INR",
    tn: `Order ${orderId}`,
  });

  return `upi://pay?${params.toString()}`;
}

app.post("/api/checkout/create-order", async (req, res) => {
  try {
    const { user, items = [], shippingAddress, paymentMethod = "upi", saveAddress = false } = req.body;

    if (!items.length) return res.status(400).json({ error: "Cart is empty." });

    if (
      !shippingAddress?.fullName ||
      !shippingAddress?.phone ||
      !shippingAddress?.line1 ||
      !shippingAddress?.city ||
      !shippingAddress?.state ||
      !shippingAddress?.pincode
    ) {
      return res.status(400).json({ error: "Shipping address is incomplete." });
    }

    const orderItems = items.map((item) => ({
      productId: item._id,
      name: item.name,
      price: Number(item.price || 0),
      qty: 1,
      img: item.img || "",
      category: item.category || "",
    }));

    const totalAmount = orderItems.reduce((sum, item) => sum + item.price * item.qty, 0);

    const order = await Order.create({
      user,
      items: orderItems,
      shippingAddress,
      paymentMethod,
      paymentStatus: "pending",
      orderStatus: "pending",
      totalAmount,
    });

    if (saveAddress) {
      const exists = await Address.findOne({
        userEmail: user.email,
        line1: shippingAddress.line1,
        pincode: shippingAddress.pincode,
      });

      if (!exists) {
        await Address.create({
          userEmail: user.email,
          ...shippingAddress,
        });
      }
    }

    if (paymentMethod === "cod") {
      return res.json({
        message: "COD order created successfully",
        order,
      });
    }

    const merchantUpiUrl = buildUpiUrl({
      amount: totalAmount,
      orderId: order._id,
    });

    order.merchantUpiUrl = merchantUpiUrl;
    await order.save();

    res.json({
      message: "UPI order created",
      order,
      upiUrl: merchantUpiUrl,
      merchantUpiId: process.env.MERCHANT_UPI_ID || "",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/checkout/confirm-upi", async (req, res) => {
  try {
    const { orderId, paymentReference } = req.body;

    if (!orderId || !paymentReference) {
      return res.status(400).json({ error: "Order ID and payment reference are required." });
    }

    const order = await Order.findByIdAndUpdate(
      orderId,
      {
        paymentStatus: "paid",
        orderStatus: "confirmed",
        paymentReference,
      },
      { new: true }
    );

    if (!order) return res.status(404).json({ error: "Order not found." });

    res.json({ message: "Payment confirmed", order });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/checkout/orders/:email", async (req, res) => {
  try {
    const orders = await Order.find({ "user.email": req.params.email }).sort({
      createdAt: -1,
    });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/checkout/orders/:id", async (req, res) => {
  try {
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      {
        orderStatus: "cancelled",
        paymentStatus: "cancelled",
      },
      { new: true }
    );

    res.json({ message: "Order cancelled", order });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.use("/api/admin", adminRoutes);

app.get("/api/me",  async (req, res) => {
  res.json({
    user: {
      id: req.user._id,
      username: req.user.username,
      email: req.user.email,
      isAdmin: req.user.isAdmin,
    },
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});






