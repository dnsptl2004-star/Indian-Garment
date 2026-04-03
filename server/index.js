import express from "express";
import cors from "cors";

const app = express();

app.use(cors({ origin: " *\ }));
app.use(express.json());

// ✅ ROOT ROUTE
app.get("/", (req, res) => {
  res.send("✅ Backend is LIVE");
});

// ✅ PRODUCTS ROUTE
app.get("/api/products", (req, res) => {
  res.json([
    { name: "Kurta", price: 999 },
    { name: "Shirt", price: 1299 }
  ]);
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});
