/**
 * Reassign all data owned by the legacy demo user ("seed-user-alex") to a real
 * registered account. Run ONCE after you register your own account:
 *
 *   npm run db:claim -- --email you@example.com
 *
 * Refuses to run if the target account doesn't exist, and is idempotent
 * (re-running just finds nothing left to move). The auth account's name is
 * kept; the legacy app-user doc and legacy settings are removed in favour of
 * the ones created for your account at signup.
 */
import { MongoClient } from "mongodb";
import { loadScriptEnv } from "./_env";

const LEGACY_USER = "seed-user-alex";
const COLLECTIONS = [
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
] as const;

async function main() {
  loadScriptEnv();
  const emailFlag = process.argv.indexOf("--email");
  const email = emailFlag > -1 ? process.argv[emailFlag + 1] : undefined;
  if (!email) {
    console.error("Usage: npm run db:claim -- --email you@example.com");
    process.exit(1);
  }
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set (check .env.local).");

  const client = new MongoClient(uri);
  await client.connect();
  try {
    const db = client.db(process.env.MONGODB_DB ?? "puma");

    // Better Auth stores accounts in the `user` collection.
    const account = await db.collection("user").findOne({ email });
    if (!account) {
      console.error(
        `No registered account found for ${email}. Register in the app first.`
      );
      process.exit(1);
    }
    const targetId = String(account.id ?? account._id);
    console.log(`Claiming ${LEGACY_USER} data for ${email} (${targetId})`);

    // The signup bootstrap created fresh settings + default tag for the new
    // account — drop those so the legacy ones (with your real preferences and
    // tag links) take their place without unique-index collisions.
    await db.collection("settings").deleteMany({ userId: targetId });
    await db.collection("tags").deleteMany({ userId: targetId });

    for (const name of COLLECTIONS) {
      const res = await db
        .collection(name)
        .updateMany({ userId: LEGACY_USER }, { $set: { userId: targetId } });
      if (res.modifiedCount) console.log(`  ${name}: ${res.modifiedCount} moved`);
    }

    // Keep the app-user doc for the target account; remove the legacy one.
    await db.collection("users").deleteOne({ _id: LEGACY_USER as never });

    console.log("Claim complete — sign in and your data is yours.");
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
