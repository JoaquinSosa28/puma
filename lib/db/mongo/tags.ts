import { getDb } from "@/lib/mongodb";
import { newId } from "@/lib/store/memory";
import { toDto, type Tag, tagSchema } from "@/lib/schemas";
import type { TagDoc } from "@/lib/schemas";
import { TAG_PALETTE } from "@/lib/types";
import { iso } from "@/lib/date";

async function col() {
  const db = await getDb();
  return db.collection<TagDoc>("tags");
}

export async function listTags(): Promise<Tag[]> {
  const c = await col();
  const docs = await c.find({}).sort({ order: 1 }).toArray();
  return docs.map((t) => toDto(tagSchema.parse(t)));
}

export async function getTagByName(name: string): Promise<Tag | null> {
  const tags = await listTags();
  return tags.find((t) => t.name === name) ?? null;
}

export async function insertTag(name: string): Promise<Tag | null> {
  const c = await col();
  const existing = await c.findOne({ name });
  if (existing) return null;
  const count = await c.countDocuments({});
  const tag: TagDoc = {
    _id: newId(),
    name,
    color: TAG_PALETTE[count % TAG_PALETTE.length],
    isDefault: false,
    order: count,
    createdAt: iso(),
  };
  await c.insertOne(tag);
  return toDto(tagSchema.parse(tag));
}

export async function ensureTags(names: string[]): Promise<string[]> {
  const ids: string[] = [];
  for (const name of names) {
    let tag = await getTagByName(name);
    if (!tag) {
      tag = (await insertTag(name))!;
    }
    ids.push(tag.id);
  }
  return ids;
}
