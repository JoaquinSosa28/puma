import { getStore } from "@/lib/store/memory";
import { newId } from "@/lib/store/memory";
import { toDto, type Tag, tagSchema } from "@/lib/schemas";
import { TAG_PALETTE } from "@/lib/types";
import { iso } from "@/lib/date";

export async function listTags(): Promise<Tag[]> {
  const store = getStore();
  return store.tags
    .sort((a, b) => a.order - b.order)
    .map((t) => toDto(tagSchema.parse(t)));
}

export async function getTagByName(name: string): Promise<Tag | null> {
  const tags = await listTags();
  return tags.find((t) => t.name === name) ?? null;
}

export async function insertTag(name: string): Promise<Tag | null> {
  const store = getStore();
  const existing = store.tags.find((t) => t.name === name);
  if (existing) return null;
  const tag = {
    _id: newId(),
    name,
    color: TAG_PALETTE[store.tags.length % TAG_PALETTE.length],
    isDefault: false,
    order: store.tags.length,
    createdAt: iso(),
  };
  store.tags.push(tag);
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
