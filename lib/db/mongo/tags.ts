import { getDb } from "@/lib/mongodb";
import {
  SPECIAL_LIFE_TAGS,
  LIFE_TAG_COLORS,
} from "@/lib/life-area-sync";
import { newId } from "@/lib/store/memory";
import { toDto, type Tag, tagSchema } from "@/lib/schemas";
import type { NoteDoc, TagDoc, TaskDoc } from "@/lib/schemas";
import { TAG_PALETTE } from "@/lib/types";
import { iso } from "@/lib/date";

async function col() {
  const db = await getDb();
  return db.collection<TagDoc>("tags");
}

export async function listTags(userId: string): Promise<Tag[]> {
  const c = await col();
  const docs = await c.find({ userId }).sort({ order: 1 }).toArray();
  return docs.map((t) => toDto(tagSchema.parse(t)));
}

export async function getTagByName(
  userId: string,
  name: string
): Promise<Tag | null> {
  const c = await col();
  const doc = await c.findOne({ userId, name });
  return doc ? toDto(tagSchema.parse(doc)) : null;
}

export async function insertTag(
  userId: string,
  name: string,
  opts?: { projectId?: string | null; isProjectPrimary?: boolean; color?: string }
): Promise<Tag | null> {
  const c = await col();
  const existing = await c.findOne({ userId, name });
  if (existing) return null;
  const count = await c.countDocuments({ userId });
  const tag: TagDoc = {
    _id: newId(),
    userId,
    name,
    color: opts?.color ?? TAG_PALETTE[count % TAG_PALETTE.length],
    isDefault: false,
    projectId: opts?.projectId ?? null,
    isProjectPrimary: opts?.isProjectPrimary ?? false,
    order: count,
    createdAt: iso(),
  };
  await c.insertOne(tag);
  return toDto(tagSchema.parse(tag));
}

/** Signup bootstrap: the "note" default tag every account starts with. */
/**
 * The two life tags every account has. They carry the personal/work split, so
 * they're created up front and can't be removed — see isLifeTag.
 */
export async function ensureLifeTags(userId: string): Promise<void> {
  const c = await col();
  for (const [i, name] of SPECIAL_LIFE_TAGS.entries()) {
    await c.updateOne(
      { userId, name },
      {
        $setOnInsert: {
          _id: newId(),
          userId,
          name,
          color: LIFE_TAG_COLORS[name],
          isDefault: true,
          projectId: null,
          isProjectPrimary: false,
          order: i,
          createdAt: iso(),
        },
      },
      { upsert: true }
    );
  }
}

export async function updateTag(
  userId: string,
  id: string,
  patch: { name?: string; color?: string }
): Promise<Tag | null> {
  const c = await col();
  if (patch.name) {
    // Names are unique per user — reject a rename that collides.
    const clash = await c.findOne({ userId, name: patch.name, _id: { $ne: id } });
    if (clash) return null;
  }
  const doc = await c.findOneAndUpdate(
    { _id: id, userId },
    { $set: patch },
    { returnDocument: "after" }
  );
  return doc ? toDto(tagSchema.parse(doc)) : null;
}

/** Re-insert whole tag docs — used to undo a cleanup, so ids/colors survive. */
export async function restoreTags(
  userId: string,
  docs: TagDoc[]
): Promise<number> {
  if (!docs.length) return 0;
  const c = await col();
  let restored = 0;
  for (const doc of docs) {
    // Scoped + idempotent: never let a stale undo write into another account.
    const res = await c.updateOne(
      { _id: doc._id, userId },
      { $setOnInsert: { ...doc, userId } },
      { upsert: true }
    );
    if (res.upsertedCount) restored += 1;
  }
  return restored;
}

export async function deleteTag(userId: string, id: string): Promise<boolean> {
  const db = await getDb();
  // Detach from everything that references it, then remove the tag itself.
  await Promise.all([
    db
      .collection<TaskDoc>("tasks")
      .updateMany({ userId, tagIds: id }, { $pull: { tagIds: id } }),
    db
      .collection<NoteDoc>("notes")
      .updateMany({ userId, tagIds: id }, { $pull: { tagIds: id } }),
  ]);
  const res = await (await col()).deleteOne({ _id: id, userId });
  return res.deletedCount > 0;
}

export async function ensureTags(
  userId: string,
  names: string[]
): Promise<string[]> {
  const ids: string[] = [];
  for (const name of names) {
    let tag = await getTagByName(userId, name);
    if (!tag) {
      tag = (await insertTag(userId, name))!;
    }
    ids.push(tag.id);
  }
  return ids;
}

export async function detachTagFromProject(
  userId: string,
  id: string
): Promise<void> {
  const c = await col();
  await c.updateOne(
    { _id: id, userId },
    { $set: { projectId: null, isProjectPrimary: false } }
  );
}
