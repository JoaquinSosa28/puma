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
      .createIndex({ userId: 1, habitId: 1, date: 1 }, { unique: true });
    await db.collection("habits").createIndex({ userId: 1 });
    await db.collection("goals").createIndex({ userId: 1, category: 1, order: 1 });
    await db.collection("tags").createIndex({ userId: 1, name: 1 }, { unique: true });
    await db.collection("notes").createIndex({ title: "text", body: "text" });
    await db.collection("settings").createIndex({ userId: 1 }, { unique: true });
    await db
      .collection("lifeWeeks")
      .createIndex({ userId: 1, weekStart: 1 }, { unique: true });
    await db
      .collection("lifeDays")
      .createIndex({ userId: 1, date: 1 }, { unique: true });

    // Billing + demo (landing/payments feature)
    await db
      .collection("subscriptions")
      .createIndex({ userId: 1 }, { unique: true });
    // Processed webhook ids only matter within the provider's retry window.
    await db
      .collection("webhookEvents")
      .createIndex({ receivedAt: 1 }, { expireAfterSeconds: 30 * 86_400 });
    // Demo/register rate-limit counters self-expire.
    await db
      .collection("rateLimits")
      .createIndex({ createdAt: 1 }, { expireAfterSeconds: 2 * 86_400 });
    await db.collection("users").createIndex({ isDemo: 1, demoExpiresAt: 1 });

    console.log(`Indexes created on "${dbName}".`);
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
