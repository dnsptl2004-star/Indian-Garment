import express from "express";
import Product from "../models/Product.js";

const router = express.Router();

// Get all products
router.get("/", async (_req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add a product (optional)
router.post("/", async (req, res) => {
  try {
    const { name, price, img } = req.body;
    const product = new Product({ name, price, img });
    await product.save();
    res.json({ message: "✅ Product added", product });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;







