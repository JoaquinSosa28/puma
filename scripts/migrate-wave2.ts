/**
 * Wave-2 schema migration (idempotent — safe to re-run):
 *   1. habitEntries: backfill `userId` from the owning habit; replace the
 *      {habitId,date} unique index with {userId,habitId,date}.
 *   2. tags: backfill `userId` (legacy tags belong to the demo user);
 *      replace the global {name} unique index with {userId,name}.
 *
 *   npm run db:migrate-wave2
 */
import { MongoClient } from "mongodb";
import { loadScriptEnv } from "./_env";

const LEGACY_USER = "seed-user-alex";

async function main() {
  loadScriptEnv();
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set (check .env.local).");
  const client = new MongoClient(uri);
  await client.connect();
  try {
    const db = client.db(process.env.MONGODB_DB ?? "puma");

    // 1. habitEntries.userId ← owning habit's userId
    const habits = await db
      .collection("habits")
      .find({}, { projection: { _id: 1, userId: 1 } })
      .toArray();
    let backfilled = 0;
    for (const h of habits) {
      const res = await db
        .collection("habitEntries")
        .updateMany(
          { habitId: h._id, userId: { $exists: false } },
          { $set: { userId: h.userId } }
        );
      backfilled += res.modifiedCount;
    }
    // Orphan entries (habit deleted before this migration) → legacy user.
    const orphans = await db
      .collection("habitEntries")
      .updateMany({ userId: { $exists: false } }, { $set: { userId: LEGACY_USER } });
    console.log(
      `habitEntries: backfilled ${backfilled} from habits, ${orphans.modifiedCount} orphans → ${LEGACY_USER}`
    );

    try {
      await db.collection("habitEntries").dropIndex("habitId_1_date_1");
      console.log("habitEntries: dropped legacy {habitId,date} index");
    } catch {
      /* already dropped */
    }
    await db
      .collection("habitEntries")
      .createIndex({ userId: 1, habitId: 1, date: 1 }, { unique: true });
    console.log("habitEntries: created {userId,habitId,date} unique index");

    // 2. tags.userId ← legacy user
    const tagRes = await db
      .collection("tags")
      .updateMany({ userId: { $exists: false } }, { $set: { userId: LEGACY_USER } });
    console.log(`tags: backfilled ${tagRes.modifiedCount} → ${LEGACY_USER}`);

    try {
      await db.collection("tags").dropIndex("name_1");
      console.log("tags: dropped legacy global {name} unique index");
    } catch {
      /* already dropped */
    }
    await db.collection("tags").createIndex({ userId: 1, name: 1 }, { unique: true });
    console.log("tags: created {userId,name} unique index");

    console.log("Wave-2 migration complete.");
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
