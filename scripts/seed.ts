/**
 * Seed a MongoDB database with the same demo data the in-memory store uses.
 * Idempotent: does nothing if the `users` collection is already populated.
 *
 *   npm run db:seed
 */
import { MongoClient, type Document } from "mongodb";
import { loadScriptEnv } from "./_env";
import { createSeedData, type SeedData } from "@/lib/seed";

// Must match getCurrentUserId() in lib/store/memory.ts.
const SEED_USER_ID = "seed-user-alex";

// SeedData keys map 1:1 to collection names.
const COLLECTIONS = [
  "users",
  "settings",
  "tags",
  "tasks",
  "habits",
  "habitEntries",
  "notes",
  "goals",
  "projects",
  "agenda",
  "lifeDays",
  "lifeWeeks",
] as const satisfies readonly (keyof SeedData)[];

async function main() {
  loadScriptEnv();
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set (check .env.local).");
  const dbName = process.env.MONGODB_DB ?? "puma";

  const client = new MongoClient(uri);
  await client.connect();
  try {
    const db = client.db(dbName);
    const existing = await db.collection("users").countDocuments({});
    if (existing > 0) {
      console.log(`Skipping seed: "${dbName}" already has ${existing} user(s).`);
      return;
    }

    const data = createSeedData(SEED_USER_ID);
    for (const name of COLLECTIONS) {
      const docs = data[name];
      if (docs.length) {
        // Docs carry string _id (hex), not ObjectId; cast past the driver's
        // default OptionalId<_id: ObjectId> typing.
        await db.collection(name).insertMany(docs as unknown as Document[]);
        console.log(`  ${name}: inserted ${docs.length}`);
      }
    }
    console.log(`Seeded "${dbName}".`);
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
