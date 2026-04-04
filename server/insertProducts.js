import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

async function seedProducts() {
  try {
    // Connect DB
    await mongoose.connect(process.env.MONGO_URI);

    console.log("✅ MongoDB Connected");

    // Schema
    const productSchema = new mongoose.Schema({
      name: String,
      category: String,
      price: Number,
      img: String,
      description: String,
      size: [String],
      brand: String,
      fabric: String,
      inStock: Boolean
    });

    const Product = mongoose.model("Product", productSchema);

    // Data
    const products = [
      {
        name: "Men's Cotton Kurta - White",
        category: "Kurta",
        price: 999,
        img: "https://images.unsplash.com/photo-1593030761757-71fae45fa0e7?auto=format&fit=crop&q=80&w=1000",
        description: "Elegant white cotton kurta perfect for festivals.",
        size: ["S","M","L","XL"],
        brand: "FabIndia",
        fabric: "Cotton",
        inStock: true
      },
      {
        name: "Silk Festive Kurta - Maroon",
        category: "Kurta",
        price: 1999,
        img: "https://images.unsplash.com/photo-1622445275463-afa2ab738c34?auto=format&fit=crop&q=80&w=1000",
        description: "Premium silk kurta for weddings.",
        size: ["M","L","XL"],
        brand: "Manyavar",
        fabric: "Silk",
        inStock: true
      },
      {
        name: "Formal Shirt - Blue",
        category: "Shirt",
        price: 1299,
        img: "https://images.unsplash.com/photo-1603252109303-2751441dd157?auto=format&fit=crop&q=80&w=1000",
        description: "Office wear slim-fit shirt.",
        size: ["S","M","L","XL"],
        brand: "Louis Philippe",
        fabric: "Cotton",
        inStock: true
      },
      {
        name: "Casual Check Shirt",
        category: "Shirt",
        price: 899,
        img: "https://images.unsplash.com/photo-1520975916090-3105956dac38?auto=format&fit=crop&q=80&w=1000",
        description: "Casual wear shirt.",
        size: ["M","L","XL"],
        brand: "Roadster",
        fabric: "Cotton",
        inStock: true
      },
      {
        name: "Formal Pant - Black",
        category: "Pant",
        price: 1499,
        img: "https://images.unsplash.com/photo-1583006170688-0d37b7c4e39c?auto=format&fit=crop&q=80&w=1000",
        description: "Formal trousers.",
        size: ["30","32","34","36"],
        brand: "Peter England",
        fabric: "Polyester",
        inStock: true
      }
    ];

    // Insert
    await Product.deleteMany();
    await Product.insertMany(products);

    console.log("🔥 Data Inserted Successfully");

  } catch (err) {
    console.error("❌ Error:", err);
  } finally {
    await mongoose.connection.close();
    console.log("🔌 Connection Closed");
  }
}

seedProducts();