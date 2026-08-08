/**
 * Prove it, don't assume it.
 *
 *   npm run db:encryption-audit
 *
 * Reads every content field of every document straight from Mongo — no
 * decryption, no repository layer — and reports anything still readable. This
 * is the check that a missed call site cannot hide from: if some write path
 * bypasses lib/db/mongo/encrypted.ts, plaintext lands in the database and this
 * script says so.
 *
 * Exits non-zero when it finds plaintext, so it can gate a deploy.
 */
import { MongoClient } from "mongodb";
import { loadScriptEnv } from "./_env";
import { isCiphertext } from "../lib/crypto/fields";
import {
  SPECS,
  specFor,
  type EncryptedCollection,
} from "../lib/crypto/specs";

/** Show enough to recognise the row, never enough to be a leak in the log. */
function preview(value: string): string {
  const flat = value.replace(/\s+/g, " ").trim();
  return flat.length <= 32 ? flat : flat.slice(0, 32) + "…";
}

async function main() {
  loadScriptEnv();
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set (check .env.local).");

  const client = new MongoClient(uri);
  await client.connect();
  try {
    const db = client.db(process.env.MONGODB_DB ?? "pumma");

    // Demo accounts are seeded server-side from a fixture and are deleted
    // within 12 hours. They hold no real data, so plaintext there is noise
    // rather than a finding — counted separately so it can't mask a real one.
    const demoIds = new Set(
      (
        await db
          .collection("users")
          .find({ isDemo: true }, { projection: { _id: 1 } })
          .toArray()
      ).map((u) => String(u._id))
    );

    let plaintext = 0;
    let encrypted = 0;
    let demo = 0;

    for (const name of Object.keys(SPECS) as EncryptedCollection[]) {
      const spec = specFor(name);
      const docs = await db.collection(name).find({}).toArray();

      for (const doc of docs) {
        const raw = doc as Record<string, unknown>;
        const isDemo = demoIds.has(String(raw.userId));

        const check = (field: string, value: unknown, where: string) => {
          if (typeof value !== "string" || value === "") return;
          if (isCiphertext(value)) {
            encrypted += 1;
            return;
          }
          if (isDemo) {
            demo += 1;
            return;
          }
          plaintext += 1;
          console.log(
            `  PLAINTEXT  ${name}.${where}  _id=${String(raw._id)}  "${preview(value)}"`
          );
        };

        for (const field of spec.fields) check(field, raw[field], field);

        for (const arr of spec.arrays ?? []) {
          const items = raw[arr.path];
          if (!Array.isArray(items)) continue;
          items.forEach((item, i) => {
            if (!item || typeof item !== "object") return;
            const obj = item as Record<string, unknown>;
            for (const field of arr.fields) {
              check(field, obj[field], `${arr.path}[${i}].${field}`);
            }
          });
        }
      }
    }

    // A tag that is encrypted but has no nameKey cannot be found by name and
    // is not covered by the unique index — broken rather than merely readable.
    const orphanTags = await db
      .collection("tags")
      .countDocuments({ nameKey: { $exists: false } });

    console.log(
      `\nencrypted ${encrypted}  plaintext ${plaintext}  demo-account plaintext ${demo}`
    );
    if (orphanTags) console.log(`tags without a nameKey: ${orphanTags}`);

    if (plaintext || orphanTags) {
      console.log("\nFAIL — run `npm run db:encrypt` and audit again.");
      process.exitCode = 1;
    } else {
      console.log("\nOK — no readable content outside demo accounts.");
    }
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
