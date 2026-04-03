import dotenv from "dotenv";
import { MongoClient } from "mongodb";
import bcrypt from "bcryptjs";

dotenv.config();

const uri = process.env.MONGO_URI;

if (!uri) {
  console.error("MONGO_URI is missing in .env file");
  process.exit(1);
}

async function seedAdmin() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db("indian_garment");
    const users = db.collection("users");

    const adminEmail = "admin@gmail.com";
    const adminPassword = "123";

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

    if (result.upsertedId) {
      console.log("✅ Admin created");
    } else if (result.modifiedCount > 0) {
      console.log("⚡ Admin already existed, updated");
    } else {
      console.log("ℹ️ No changes made");
    }
  } catch (err) {
    console.error("❌ Error seeding admin:", err);
  } finally {
    await client.close();
  }
}

seedAdmin();