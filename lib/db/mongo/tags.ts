import { getDb } from "@/lib/mongodb";
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
  name: string
): Promise<Tag | null> {
  const c = await col();
  const existing = await c.findOne({ userId, name });
  if (existing) return null;
  const count = await c.countDocuments({ userId });
  const tag: TagDoc = {
    _id: newId(),
    userId,
    name,
    color: TAG_PALETTE[count % TAG_PALETTE.length],
    isDefault: false,
    order: count,
    createdAt: iso(),
  };
  await c.insertOne(tag);
  return toDto(tagSchema.parse(tag));
}

/** Signup bootstrap: the "note" default tag every account starts with. */
export async function ensureDefaultTag(userId: string): Promise<void> {
  const c = await col();
  await c.updateOne(
    { userId, name: "note" },
    {
      $setOnInsert: {
        _id: newId(),
        userId,
        name: "note",
        color: "#8a8580",
        isDefault: true,
        order: 0,
        createdAt: iso(),
      },
    },
    { upsert: true }
  );
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
