/**
 * Create the recommended indexes for the MongoDB backend.
 * Safe to re-run: createIndex is idempotent for identical specs.
 *
 *   npm run db:indexes
 */
import { MongoClient } from "mongodb";
import { loadScriptEnv } from "./_env";

async function main() {
  loadScriptEnv();
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set (check .env.local).");
  const dbName = process.env.MONGODB_DB ?? "puma";

  const client = new MongoClient(uri);
  await client.connect();
  try {
    const db = client.db(dbName);

    await db.collection("tasks").createIndexes([
      { key: { userId: 1, due: 1 } },
      { key: { userId: 1, status: 1 } },
      { key: { projectId: 1 } },
    ]);
    await db
      .collection("habitEntries")
      .createIndex({ habitId: 1, date: 1 }, { unique: true });
    await db.collection("habits").createIndex({ userId: 1 });
    await db.collection("goals").createIndex({ userId: 1, category: 1, order: 1 });
    await db.collection("tags").createIndex({ name: 1 }, { unique: true });
    await db.collection("notes").createIndex({ title: "text", body: "text" });
    await db.collection("settings").createIndex({ userId: 1 }, { unique: true });
    await db
      .collection("lifeWeeks")
      .createIndex({ userId: 1, weekStart: 1 }, { unique: true });
    await db
      .collection("lifeDays")
      .createIndex({ userId: 1, date: 1 }, { unique: true });

    console.log(`Indexes created on "${dbName}".`);
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
