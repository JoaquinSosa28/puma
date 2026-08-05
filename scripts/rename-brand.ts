/**
 * PUMA → PUMMA, in the data.
 *
 * The rename was a code change: every "PUMA" the app says is a literal in the
 * source. Nothing in Mongo is keyed on the name — no collection, no field, no
 * index — so strictly speaking there is nothing to migrate.
 *
 * What *can* carry the old name is content someone typed: a project called
 * "PUMA Development", a tag, a note that mentions it. That is the user's
 * writing rather than the app's, so this script defaults to reporting and
 * changes nothing until it is asked to.
 *
 *   npx tsx scripts/rename-brand.ts          # scan, print what would change
 *   npx tsx scripts/rename-brand.ts --apply  # actually rewrite those fields
 *
 * Idempotent: "PUMMA" no longer matches, so a second run is a no-op.
 */
import { MongoClient } from "mongodb";
import fs from "node:fs";

/** Text fields worth looking at, per collection. */
const TEXT_FIELDS: Record<string, string[]> = {
  tasks: ["title", "description"],
  notes: ["title", "body"],
  projects: ["title", "description"],
  goals: ["title", "description"],
  habits: ["name"],
  tags: ["name"],
  agenda: ["title", "notes"],
  users: ["name"],
};

/**
 * The same rules the source got, longest first so "P.U.M.A" is never eaten by
 * the plain-word case. Word-bounded: a tag called "pumakit" is not the brand.
 */
const RULES: [RegExp, string][] = [
  [/Procrastination Ultimate Management App/g, "Procrastination Ultimate Megasor Monster Annihilator"],
  [/P\.U\.M\.A\b/g, "P.U.M.M.A"],
  [/\bPUMA\b/g, "PUMMA"],
  [/\bPuma\b/g, "Pumma"],
  [/\bpuma\b/g, "pumma"],
];

function rewrite(value: string): string {
  return RULES.reduce((s, [re, to]) => s.replace(re, to), value);
}

function loadEnv(): Record<string, string> {
  return Object.fromEntries(
    fs
      .readFileSync(".env.local", "utf8")
      .split("\n")
      .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
      })
  );
}

async function main() {
  const apply = process.argv.includes("--apply");
  const env = loadEnv();
  const client = new MongoClient(env.MONGODB_URI);
  await client.connect();
  const db = client.db(env.MONGODB_DB ?? "puma");

  let hits = 0;
  let written = 0;

  for (const [name, fields] of Object.entries(TEXT_FIELDS)) {
    const col = db.collection(name);
    for await (const doc of col.find({})) {
      const patch: Record<string, string> = {};
      for (const f of fields) {
        const v = (doc as Record<string, unknown>)[f];
        if (typeof v !== "string") continue;
        const next = rewrite(v);
        if (next !== v) patch[f] = next;
      }
      if (!Object.keys(patch).length) continue;
      hits++;
      for (const [f, next] of Object.entries(patch)) {
        console.log(
          `${name}/${doc._id} ${f}:\n    - ${JSON.stringify((doc as Record<string, unknown>)[f])}\n    + ${JSON.stringify(next)}`
        );
      }
      if (apply) {
        await col.updateOne({ _id: doc._id }, { $set: patch });
        written++;
      }
    }
  }

  console.log(
    hits === 0
      ? "\nNothing in the database carries the old name — no migration needed."
      : `\n${hits} document(s) matched${apply ? `, ${written} rewritten.` : " (dry run — pass --apply to write)."}`
  );
  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
