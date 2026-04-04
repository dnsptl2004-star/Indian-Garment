import mongoose from "mongoose";
import dotenv from "dotenv";
import Product from "./models/Product.js";

dotenv.config();

await mongoose.connect(process.env.MONGO_URI || "mongodb+srv://Dhruv:Dhruv123@cluster0.ddark6d.mongodb.net/indian_garment?retryWrites=true&w=majority");

const products = [
  {
    name: "Men's Cotton Kurta - White",
    category: "Kurta",
    price: 999,
    img: "https://images.unsplash.com/photo-1593030761757-71fae45fa0e7?auto=format&fit=crop&q=80&w=1000",
    description: "Elegant white cotton kurta for festivals and family functions.",
    size: ["S", "M", "L", "XL"],
    brand: "FabIndia",
    fabric: "Cotton",
    color: "White",
    occasion: "Festive",
    inStock: true,
  },
  {
    name: "Silk Festive Kurta - Maroon",
    category: "Kurta",
    price: 1999,
    img: "https://images.unsplash.com/photo-1622445275463-afa2ab738c34?auto=format&fit=crop&q=80&w=1000",
    description: "Premium silk kurta for weddings and celebrations.",
    size: ["M", "L", "XL"],
    brand: "Manyavar",
    fabric: "Silk",
    color: "Maroon",
    occasion: "Wedding",
    inStock: true,
  },
  {
    name: "Formal Slim Fit Shirt - Blue",
    category: "Shirt",
    price: 1299,
    img: "https://images.unsplash.com/photo-1603252109303-2751441dd157?auto=format&fit=crop&q=80&w=1000",
    description: "Smart office shirt with a sharp slim fit.",
    size: ["S", "M", "L", "XL"],
    brand: "Louis Philippe",
    fabric: "Cotton",
    color: "Blue",
    occasion: "Formal",
    inStock: true,
  },
  {
    name: "Casual Check Shirt - Red",
    category: "Shirt",
    price: 899,
    img: "https://images.unsplash.com/photo-1520975916090-3105956dac38?auto=format&fit=crop&q=80&w=1000",
    description: "Everyday check shirt for a modern casual look.",
    size: ["M", "L", "XL"],
    brand: "Roadster",
    fabric: "Cotton",
    color: "Red",
    occasion: "Casual",
    inStock: true,
  },
  {
    name: "Formal Pant - Black",
    category: "Pant",
    price: 1499,
    img: "https://images.unsplash.com/photo-1583006170688-0d37b7c4e39c?auto=format&fit=crop&q=80&w=1000",
    description: "Classic black trousers for office and meetings.",
    size: ["30", "32", "34", "36"],
    brand: "Peter England",
    fabric: "Polyester Blend",
    color: "Black",
    occasion: "Formal",
    inStock: true,
  }
];

await Product.deleteMany();
await Product.insertMany(products);

console.log("?? Products inserted successfully");
await mongoose.connection.close();







