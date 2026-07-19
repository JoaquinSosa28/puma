/**
 * Find (and optionally unlink) dangling references — links pointing at
 * entities that no longer exist. Deletes cascade correctly, so this should
 * always report zero; it exists as a safety net for data written by older
 * builds or interrupted operations.
 *
 *   npm run db:repair-refs          # report only
 *   npm run db:repair-refs -- --fix # unlink the danglers it finds
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
    // Minimal doc shape so $pull/$in on the id-array fields typechecks.
    type LinkedDoc = {
      _id: string;
      projectId?: string | null;
      goalId?: string | null;
      tagIds?: string[];
      goalIds?: string[];
      habitId?: string;
    };
    const linked = (col: string) => db.collection<LinkedDoc>(col);
    const idSet = async (col: string) =>
      new Set(
        (
          await db
            .collection(col)
            .find({}, { projection: { _id: 1 } })
            .toArray()
        ).map((d) => String(d._id))
      );
    const [goals, projects, habits, tags] = await Promise.all([
      idSet("goals"),
      idSet("projects"),
      idSet("habits"),
      idSet("tags"),
    ]);

    let found = 0;
    const report = (kind: string, id: string, dead: string) => {
      found += 1;
      console.log(`${kind}: ${id} -> ${dead}${fix ? " (unlinking)" : ""}`);
    };

    for (const t of await linked("tasks").find({}).toArray()) {
      if (t.projectId && !projects.has(String(t.projectId))) {
        report("task->project", String(t._id), String(t.projectId));
        if (fix)
          await linked("tasks").updateOne({ _id: t._id }, { $set: { projectId: null } });
      }
      if (t.goalId && !goals.has(String(t.goalId))) {
        report("task->goal", String(t._id), String(t.goalId));
        if (fix)
          await linked("tasks").updateOne({ _id: t._id }, { $set: { goalId: null } });
      }
      const deadTags = (t.tagIds ?? []).filter((id: string) => !tags.has(String(id)));
      if (deadTags.length) {
        report("task->tags", String(t._id), deadTags.join(","));
        if (fix)
          await linked("tasks").updateOne({ _id: t._id }, { $pull: { tagIds: { $in: deadTags } } });
      }
    }

    for (const p of await linked("projects").find({}).toArray()) {
      if (p.goalId && !goals.has(String(p.goalId))) {
        report("project->goal", String(p._id), String(p.goalId));
        if (fix)
          await linked("projects").updateOne({ _id: p._id }, { $set: { goalId: null } });
      }
    }

    for (const h of await linked("habits").find({}).toArray()) {
      const deadGoals = (h.goalIds ?? []).filter((id: string) => !goals.has(String(id)));
      if (deadGoals.length) {
        report("habit->goals", String(h._id), deadGoals.join(","));
        if (fix)
          await linked("habits").updateOne({ _id: h._id }, { $pull: { goalIds: { $in: deadGoals } } });
      }
    }

    for (const n of await linked("notes").find({}).toArray()) {
      const deadTags = (n.tagIds ?? []).filter((id: string) => !tags.has(String(id)));
      if (deadTags.length) {
        report("note->tags", String(n._id), deadTags.join(","));
        if (fix)
          await linked("notes").updateOne({ _id: n._id }, { $pull: { tagIds: { $in: deadTags } } });
      }
    }

    const orphanEntries = await linked("habitEntries").find({}).toArray();
    const dead = orphanEntries.filter((e) => !habits.has(String(e.habitId)));
    if (dead.length) {
      report("habitEntries->habit", `${dead.length} entries`, "various");
      if (fix)
        await linked("habitEntries").deleteMany({
          _id: { $in: dead.map((e) => String(e._id)) },
        });
    }

    console.log(
      found === 0
        ? "No dangling references found."
        : `${found} dangling reference group(s) ${fix ? "repaired" : "found (re-run with --fix to unlink)"}.`
    );
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
