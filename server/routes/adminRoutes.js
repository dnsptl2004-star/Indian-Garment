import express from "express";
import User from "../models/User.js";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import Address from "../models/Address.js";

const router = express.Router();

router.get("/summary", async (req, res) => {
  const users = await User.countDocuments();
  const products = await Product.countDocuments();
  const orders = await Order.countDocuments();
  const revenueData = await Order.find();

  const revenue = revenueData.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

  res.json({ users, products, orders, revenue });
});

router.get("/users", async (req, res) => {
  const users = await User.find();
  res.json(users);
});

router.get("/products", async (req, res) => {
  const products = await Product.find();
  res.json(products);
});

router.get("/orders", async (req, res) => {
  const orders = await Order.find();
  res.json(orders);
});

router.get("/addresses", async (req, res) => {
  const addresses = await Address.find();
  res.json(addresses);
});

router.post("/products", async (req, res) => {
  const product = await Product.create(req.body);
  res.json(product);
});

router.put("/products/:id", async (req, res) => {
  const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(product);
});

router.delete("/products/:id", async (req, res) => {
  await Product.findByIdAndDelete(req.params.id);
  res.json({ message: "Deleted" });
});

export default router;

