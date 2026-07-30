/**
 * Remove legacy dateless "routine" agenda rows, and backfill the meeting
 * fields added alongside real recurrence support.
 *
 * Routine rows were demo fixtures: they had no date, so they repeated in the
 * Agenda every single day while never appearing on the Calendar — the exact
 * mismatch this cleanup removes. Nothing in the app has ever created them
 * (addMeetingAction only writes dated `kind: "meeting"` rows), so every
 * remaining one is seed data.
 *
 *   npm run db:cleanup-routines            # report only
 *   npm run db:cleanup-routines -- --fix   # actually delete + backfill
 */
import { MongoClient } from "mongodb";
import { loadScriptEnv } from "./_env";

async function main() {
  loadScriptEnv();
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set (check .env.local).");
  const fix = process.argv.includes("--fix");

  const client = new MongoClient(uri);
  await client.connect();
  try {
    const db = client.db(process.env.MONGODB_DB ?? "puma");
    const agenda = db.collection("agenda");

    // 1. Legacy routine / dateless rows.
    const routineFilter = {
      $or: [{ kind: "routine" }, { kind: { $exists: false } }, { date: null }],
    };
    const routines = await agenda.find(routineFilter).toArray();
    console.log(`Legacy routine/dateless agenda rows: ${routines.length}`);
    for (const r of routines) {
      console.log(`  - ${r.time ?? "??:??"} ${r.title ?? "(untitled)"} [user ${r.userId}]`);
    }

    // 2. Meetings missing the fields the new model relies on.
    const needsBackfill = await agenda.countDocuments({
      kind: "meeting",
      $or: [
        { durationMins: { $exists: false } },
        { recurrence: { $exists: false } },
        { exceptions: { $exists: false } },
        { notes: { $exists: false } },
      ],
    });
    console.log(`Meetings needing field backfill: ${needsBackfill}`);

    if (!fix) {
      console.log("\nDry run — re-run with --fix to apply.");
      return;
    }

    if (routines.length) {
      const res = await agenda.deleteMany(routineFilter);
      console.log(`Deleted ${res.deletedCount} routine row(s).`);
    }

    if (needsBackfill) {
      // Recover the old prose duration ("meeting · 45 min") where present so a
      // backfilled meeting keeps its real length instead of defaulting to 30.
      const stale = await agenda
        .find({ kind: "meeting", durationMins: { $exists: false } })
        .toArray();
      for (const m of stale) {
        const parsed = /(\d+)\s*min/i.exec(String(m.sub ?? ""));
        await agenda.updateOne(
          { _id: m._id },
          { $set: { durationMins: parsed ? Number(parsed[1]) : 30 } }
        );
      }
      // Remaining defaults, each only where the field is absent.
      const defaults: [string, unknown][] = [
        ["recurrence", null],
        ["exceptions", []],
        ["notes", ""],
      ];
      for (const [field, value] of defaults) {
        await agenda.updateMany(
          { kind: "meeting", [field]: { $exists: false } },
          { $set: { [field]: value } }
        );
      }
      console.log(`Backfilled meeting fields (${stale.length} durations recovered).`);
    }

    const left = await agenda.countDocuments(routineFilter);
    console.log(`\nDone. Remaining routine/dateless rows: ${left}`);
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
