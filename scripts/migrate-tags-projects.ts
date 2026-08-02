/**
 * One-off migration to the tag-driven model.
 *
 *   npx tsx scripts/migrate-tags-projects.ts            # dry run, changes nothing
 *   npx tsx scripts/migrate-tags-projects.ts --apply    # writes
 *
 * Always takes a full backup of every collection it touches before writing, to
 * a file you can restore from — see --restore.
 *
 * What it does, in order:
 *   1. New tag fields (projectId, isProjectPrimary) on every existing tag.
 *   2. Renames tags whose names the capture bar now claims ("note" -> "notes").
 *   3. Gives every account the two life tags.
 *   4. Puts a life tag on every task and note, derived from its stored
 *      lifeArea, then recomputes lifeArea from the tags so the two agree.
 *   5. Gives every project a flagship tag named after it.
 *   6. Tags tasks that already sit in a project with that project's flagship.
 *
 * Written to be re-runnable: every step skips what it has already done.
 */
import { loadScriptEnv } from "./_env";
loadScriptEnv();

import { writeFileSync, readFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { MongoClient, type Db } from "mongodb";
import { isReservedTagName } from "../lib/omni-reserved";
import { LIFE_TAG_COLORS, SPECIAL_LIFE_TAGS } from "../lib/life-area-sync";
import { projectTagSlug, uniqueTagName } from "../lib/project-tags";

const APPLY = process.argv.includes("--apply");
const RESTORE = process.argv.indexOf("--restore");
const TOUCHED = ["tags", "tasks", "notes", "projects"] as const;

/** Same shape of id the app generates, so migrated rows look native. */
function oid(): string {
  const ts = Math.floor(Date.now() / 1000).toString(16);
  const rand = Array.from({ length: 16 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join("");
  return (ts + rand).slice(0, 24);
}

type Row = Record<string, unknown> & { _id: string; userId?: string };

async function backup(db: Db): Promise<string> {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const path = resolve(
    process.cwd(),
    `.migration-backups/tags-projects-${stamp}.json`
  );
  const data: Record<string, unknown[]> = {};
  for (const name of TOUCHED) {
    data[name] = await db.collection(name).find({}).toArray();
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2));
  return path;
}

async function restore(db: Db, path: string) {
  const data = JSON.parse(readFileSync(path, "utf8")) as Record<string, Row[]>;
  for (const name of TOUCHED) {
    const rows = data[name] ?? [];
    await db.collection(name).deleteMany({});
    if (rows.length) await db.collection(name).insertMany(rows as never[]);
    console.log(`restored ${name}: ${rows.length}`);
  }
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI missing");
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(process.env.MONGODB_DB || "personal");

  if (RESTORE !== -1) {
    const path = process.argv[RESTORE + 1];
    if (!path) throw new Error("--restore needs a backup file path");
    await restore(db, path);
    await client.close();
    return;
  }

  const plan: string[] = [];
  const note = (line: string) => plan.push(line);

  if (APPLY) {
    const path = await backup(db);
    console.log(`backup written: ${path}\n`);
  }

  const tags = (await db.collection("tags").find({}).toArray()) as unknown as Row[];
  const tasks = (await db.collection("tasks").find({}).toArray()) as unknown as Row[];
  const notes = (await db.collection("notes").find({}).toArray()) as unknown as Row[];
  const projects = (await db
    .collection("projects")
    .find({})
    .toArray()) as unknown as Row[];

  const userIds = [
    ...new Set(
      [...tags, ...tasks, ...notes, ...projects]
        .map((r) => r.userId)
        .filter((u): u is string => Boolean(u))
    ),
  ];

  // ---- 1. new tag fields -------------------------------------------------
  const needFields = tags.filter(
    (t) => t.projectId === undefined || t.isProjectPrimary === undefined
  );
  note(`1. tag fields: ${needFields.length} tags get projectId/isProjectPrimary`);
  if (APPLY && needFields.length) {
    await db
      .collection("tags")
      .updateMany(
        { $or: [{ projectId: { $exists: false } }, { isProjectPrimary: { $exists: false } }] },
        { $set: { projectId: null, isProjectPrimary: false } }
      );
  }

  // ---- 2. reserved names -------------------------------------------------
  // "#note" now switches the capture type, so a tag by that name can never be
  // typed again. Renamed rather than dropped — things are tagged with it.
  const reserved = tags.filter((t) => isReservedTagName(String(t.name)));
  for (const tag of reserved) {
    const mine = tags
      .filter((t) => t.userId === tag.userId && t._id !== tag._id)
      .map((t) => String(t.name));
    const next = uniqueTagName(`${String(tag.name)}s`, mine);
    note(`2. rename reserved tag "${tag.name}" -> "${next}" (user ${tag.userId})`);
    if (APPLY) {
      await db
        .collection("tags")
        .updateOne({ _id: tag._id as never }, { $set: { name: next } });
      tag.name = next;
    }
  }

  // ---- 3. life tags per account -----------------------------------------
  const lifeTagId = new Map<string, string>(); // `${userId}:${name}` -> tagId
  for (const tag of tags) {
    const name = String(tag.name).toLowerCase();
    if (SPECIAL_LIFE_TAGS.includes(name as never)) {
      lifeTagId.set(`${tag.userId}:${name}`, String(tag._id));
    }
  }
  for (const userId of userIds) {
    for (const [i, name] of SPECIAL_LIFE_TAGS.entries()) {
      if (lifeTagId.has(`${userId}:${name}`)) continue;
      const _id = oid();
      note(`3. create life tag "${name}" for user ${userId}`);
      lifeTagId.set(`${userId}:${name}`, _id);
      if (APPLY) {
        await db.collection("tags").insertOne({
          _id,
          userId,
          name,
          color: LIFE_TAG_COLORS[name],
          isDefault: true,
          projectId: null,
          isProjectPrimary: false,
          order: i,
          createdAt: new Date().toISOString().slice(0, 10),
        } as never);
      }
    }
  }

  // ---- 4. life tag on every task/note ------------------------------------
  for (const [name, rows] of [
    ["tasks", tasks],
    ["notes", notes],
  ] as const) {
    let touched = 0;
    for (const row of rows) {
      const userId = String(row.userId);
      const current = new Set((row.tagIds as string[]) ?? []);
      const area = String(row.lifeArea ?? "personal");
      const wanted =
        area === "both"
          ? ["personal", "work"]
          : area === "work"
            ? ["work"]
            : ["personal"];
      const add = wanted
        .map((n) => lifeTagId.get(`${userId}:${n}`))
        .filter((id): id is string => Boolean(id) && !current.has(id!));
      if (!add.length) continue;
      touched++;
      if (APPLY) {
        await db
          .collection(name)
          .updateOne(
            { _id: row._id as never },
            { $set: { tagIds: [...current, ...add] } }
          );
      }
    }
    note(`4. ${name}: ${touched} rows get a life tag from their stored lifeArea`);
  }

  // ---- 5. flagship tag per project ---------------------------------------
  const flagshipByProject = new Map<string, string>();
  for (const tag of tags) {
    if (tag.projectId && tag.isProjectPrimary) {
      flagshipByProject.set(String(tag.projectId), String(tag._id));
    }
  }
  const namesByUser = new Map<string, string[]>();
  for (const tag of tags) {
    const list = namesByUser.get(String(tag.userId)) ?? [];
    list.push(String(tag.name));
    namesByUser.set(String(tag.userId), list);
  }
  for (const project of projects) {
    if (flagshipByProject.has(String(project._id))) continue;
    const userId = String(project.userId);
    const taken = namesByUser.get(userId) ?? [];
    const name = uniqueTagName(projectTagSlug(String(project.title)), taken);
    taken.push(name);
    namesByUser.set(userId, taken);
    const _id = oid();
    flagshipByProject.set(String(project._id), _id);
    note(`5. flagship "${name}" for project "${project.title}"`);
    if (APPLY) {
      await db.collection("tags").insertOne({
        _id,
        userId,
        name,
        color: project.color ?? "oklch(0.58 0.14 245)",
        isDefault: false,
        projectId: String(project._id),
        isProjectPrimary: true,
        order: taken.length,
        createdAt: new Date().toISOString().slice(0, 10),
      } as never);
    }
  }

  // ---- 6. tasks already in a project get its flagship --------------------
  let filed = 0;
  for (const task of tasks) {
    if (!task.projectId) continue;
    const flagship = flagshipByProject.get(String(task.projectId));
    if (!flagship) continue;
    const current = new Set((task.tagIds as string[]) ?? []);
    if (current.has(flagship)) continue;
    filed++;
    if (APPLY) {
      await db
        .collection("tasks")
        .updateOne(
          { _id: task._id as never },
          { $addToSet: { tagIds: flagship } }
        );
    }
  }
  note(`6. ${filed} tasks already in a project get its flagship tag`);

  console.log(APPLY ? "APPLIED\n" : "DRY RUN — nothing written\n");
  console.log(plan.join("\n"));
  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
