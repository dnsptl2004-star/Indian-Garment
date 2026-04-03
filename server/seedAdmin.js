// seedAdmin.js
import dotenv from "dotenv";
import { MongoClient } from "mongodb";
import bcrypt from "bcryptjs";

dotenv.config();

const uri = process.env.MONGO_URI || "mongodb+srv://Dhruv:Dhruv123@cluster0.ddark6d.mongodb.net/indian_garment?retryWrites=true&w=majority";

async function seedAdmin() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db("indian_garment");
    const users = db.collection("users");

    const adminEmail = "admin@gmail.com";
    const adminPassword = "admin123";

    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    const result = await users.updateOne(
      { email: adminEmail },
      {
        $set: {
          name: "Admin",
          email: adminEmail,
          password: hashedPassword,
          role: "admin",
          updatedAt: new Date(),
        },
        $setOnInsert: {
          createdAt: new Date(),
        },
      },
      { upsert: true }
    );

    if (result.upsertedCount > 0) {
      console.log("✅ Admin created");
    } else {
      console.log("⚡ Admin already exists, updated");
    }
  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}

seedAdmin();