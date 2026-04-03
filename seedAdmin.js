import dotenv from "dotenv";
import { MongoClient } from "mongodb";
import bcrypt from "bcryptjs";

dotenv.config();

const uri = process.env.MONGO_URI;
if (!uri) {
  console.error("MONGO_URI missing");
  process.exit(1);
}

async function seedAdmin() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db();
    const users = db.collection("users");

    const adminEmail = "admin@gmail.com";
    const adminPassword = "123";
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    await users.updateOne(
      { email: adminEmail },
      {
        $set: {
          name: "Admin",
          email: adminEmail,
          password: hashedPassword,
          role: "admin",
          updatedAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true }
    );

    console.log("✅ Admin seeded");
  } catch (err) {
    console.error("❌ Seed error:", err.message);
  } finally {
    await client.close();
  }
}

seedAdmin();
