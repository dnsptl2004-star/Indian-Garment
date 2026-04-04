import express from "express";
import mongoose from "mongoose";
import Order from "../models/Order.js";
import { protect as authMiddleware } from "../middleware/auth.js";

const router = express.Router();


// ✅ GET USER ORDERS
// ✅ GET USER ORDERS
router.get("/orders/:email?", async (req, res) => {
  try {
    const email = req.params.email || req.query.email;
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }
    const orders = await Order.find({ "user.email": email })
      .sort({ createdAt: -1 });

    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ✅ CREATE ORDER
router.post("/create-order", async (req, res) => {
  try {
    const { user, items, shippingAddress, paymentMethod } = req.body;

    const totalAmount = items.reduce(
      (sum, item) => sum + Number(item.price || 0),
      0
    );

    const newOrder = new Order({
      user,
      items,
      shippingAddress,
      paymentMethod,
      totalAmount,
      paymentStatus: paymentMethod === "cod" ? "pending" : "pending",
      orderStatus: "pending",
    });

    await newOrder.save();

    res.json({
      order: newOrder,
      upiUrl:
        paymentMethod === "upi"
          ? `upi://pay?pa=yourupi@bank&pn=RoyalThread&am=${totalAmount}&cu=INR`
          : null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ✅ CONFIRM UPI PAYMENT
router.post("/confirm-upi", async (req, res) => {
  try {
    const { orderId, paymentReference } = req.body;

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ error: "Order not found" });

    order.paymentStatus = "paid";
    order.paymentReference = paymentReference;
    order.orderStatus = "confirmed";

    await order.save();

    res.json({ message: "Payment confirmed" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ✅ ❗ FIXED CANCEL ORDER ROUTE
router.delete("/orders/:id", async (req, res) => {
  try {
    console.log("🔍 CANCEL REQUEST:", { 
      orderId: req.params.id, 
      isValidId: mongoose.Types.ObjectId.isValid(req.params.id),
      user: req.user?.email,
      path: req.path 
    });

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      console.log("❌ Invalid ObjectId:", req.params.id);
      return res.status(400).json({ error: "Invalid order id" });
    }

    const order = await Order.findById(req.params.id);
    console.log("🔍 Found order:", !!order, order?._id, order?.user?.email);

    if (!order) {
      console.log("❌ Order not found for ID:", req.params.id);
      return res.status(404).json({ error: "Order not found" });
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

    console.log("✅ Order cancelled:", order._id);
    res.json({ message: "Order cancelled successfully" });
  } catch (err) {
    console.error("💥 Cancel order ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;