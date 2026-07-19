import { getStore, newId } from "@/lib/store/memory";
import { toDto, type Tag, tagSchema } from "@/lib/schemas";
import type { TagDoc } from "@/lib/schemas";
import { TAG_PALETTE } from "@/lib/types";
import { iso } from "@/lib/date";

export async function listTags(userId: string): Promise<Tag[]> {
  const store = getStore();
  return store.tags
    .filter((t) => t.userId === userId)
    .sort((a, b) => a.order - b.order)
    .map((t) => toDto(tagSchema.parse(t)));
}

export async function getTagByName(
  userId: string,
  name: string
): Promise<Tag | null> {
  const store = getStore();
  const doc = store.tags.find((t) => t.userId === userId && t.name === name);
  return doc ? toDto(tagSchema.parse(doc)) : null;
}

export async function insertTag(
  userId: string,
  name: string
): Promise<Tag | null> {
  const store = getStore();
  if (store.tags.some((t) => t.userId === userId && t.name === name)) return null;
  const mine = store.tags.filter((t) => t.userId === userId);
  const tag: TagDoc = {
    _id: newId(),
    userId,
    name,
    color: TAG_PALETTE[mine.length % TAG_PALETTE.length],
    isDefault: false,
    order: mine.length,
    createdAt: iso(),
  };
  store.tags.push(tag);
  return toDto(tagSchema.parse(tag));
}

/** Signup bootstrap: the "note" default tag every account starts with. */
export async function ensureDefaultTag(userId: string): Promise<void> {
  const store = getStore();
  if (store.tags.some((t) => t.userId === userId && t.name === "note")) return;
  store.tags.push({
    _id: newId(),
    userId,
    name: "note",
    color: "#8a8580",
    isDefault: true,
    order: 0,
    createdAt: iso(),
  });
}

export async function updateTag(
  userId: string,
  id: string,
  patch: { name?: string; color?: string }
): Promise<Tag | null> {
  const store = getStore();
  const idx = store.tags.findIndex((t) => t._id === id && t.userId === userId);
  if (idx < 0) return null;
  if (
    patch.name &&
    store.tags.some(
      (t) => t.userId === userId && t.name === patch.name && t._id !== id
    )
  ) {
    return null;
  }
  store.tags[idx] = { ...store.tags[idx], ...patch };
  return toDto(tagSchema.parse(store.tags[idx]));
}

export async function deleteTag(userId: string, id: string): Promise<boolean> {
  const store = getStore();
  const idx = store.tags.findIndex((t) => t._id === id && t.userId === userId);
  if (idx < 0) return false;
  for (const t of store.tasks) {
    if (t.userId === userId && t.tagIds.includes(id)) {
      t.tagIds = t.tagIds.filter((x) => x !== id);
    }
  }
  for (const n of store.notes) {
    if (n.userId === userId && n.tagIds.includes(id)) {
      n.tagIds = n.tagIds.filter((x) => x !== id);
    }
  }
  store.tags.splice(idx, 1);
  return true;
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
