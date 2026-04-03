import express from "express";
import Address from "../models/Address.js";
import Order from "../models/Order.js";
import Product from "../models/Product.js";

const router = express.Router();

function buildUpiUrl({ amount, orderId }) {
  const storeName = process.env.STORE_NAME || "Indian Garments";
  const merchantUpi = process.env.MERCHANT_UPI_ID || "dnsptl2004@oksbi";

  const params = new URLSearchParams({
    pa: merchantUpi,
    pn: storeName,
    am: Number(amount).toFixed(2),
    cu: "INR",
    tn: `Order ${orderId}`,
  });

  return `upi://pay?${params.toString()}`;
}

function groupCartItems(items = []) {
  const map = new Map();
  for (const item of items) {
    const id = String(item._id || item.productId);
    if (!id) continue;
    if (map.has(id)) map.get(id).qty += 1;
    else map.set(id, { productId: id, qty: 1 });
  }
  return [...map.values()];
}

router.post("/addresses", async (req, res) => {
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

router.get("/addresses/:email", async (req, res) => {
  try {
    const addresses = await Address.find({ userEmail: req.params.email }).sort({ createdAt: -1 });
    res.json(addresses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/create-order", async (req, res) => {
  try {
    const { user, items = [], shippingAddress, paymentMethod = "upi" } = req.body;

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

    const grouped = groupCartItems(items);
    const productIds = grouped.map((item) => item.productId);
    const dbProducts = await Product.find({ _id: { $in: productIds } });

    const orderItems = dbProducts.map((product) => {
      const matched = grouped.find((g) => String(g.productId) === String(product._id));
      return {
        productId: product._id,
        name: product.name,
        price: Number(product.price || 0),
        qty: matched?.qty || 1,
        img: product.img || "",
        category: product.category || "",
      };
    });

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

    if (paymentMethod === "cod") {
      return res.json({ message: "Cash on Delivery order created", order });
    }

    const merchantUpiUrl = buildUpiUrl({ amount: totalAmount, orderId: order._id });
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

router.post("/confirm-upi", async (req, res) => {
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

    if (!order) {
      return res.status(404).json({ error: "Order not found." });
    }

    res.json({ message: "Payment confirmed", order });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/orders/:email", async (req, res) => {
  try {
    const orders = await Order.find({ "user.email": req.params.email }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/orders/:id", async (req, res) => {
  try {
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { orderStatus: "cancelled", paymentStatus: "cancelled" },
      { new: true }
    );
    res.json({ message: "Order cancelled", order });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;







