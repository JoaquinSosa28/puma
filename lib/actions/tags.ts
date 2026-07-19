"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/types";
import type { Tag } from "@/lib/schemas";
import { userToday } from "@/lib/timezone-server";
import { requireUserId } from "@/lib/auth/session";
import { getTask, updateTask } from "@/lib/db/tasks";
import { getNote, updateNote } from "@/lib/db/notes";
import { deleteTag, listTags, updateTag } from "@/lib/db/tags";
import { cssColor, entityId, tagName } from "@/lib/validation";
import { deriveLifeAreaFromTags } from "@/lib/life-area-sync";

export type TaggableEntity = "task" | "note";

const toggleSchema = z.object({
  entity: z.enum(["task", "note"]),
  entityId,
  tagId: entityId,
});

export async function toggleEntityTag(
  entity: TaggableEntity,
  targetId: string,
  tagId: string
): Promise<ActionResult<{ applied: boolean }>> {
  const parsed = toggleSchema.safeParse({ entity, entityId: targetId, tagId });
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const { entityId: id, tagId: tag } = parsed.data;
  const userId = await requireUserId();
  const tags = await listTags(userId);
  // A stale menu can reference a tag deleted since the client last rendered.
  if (!tags.some((t) => t.id === tag)) {
    return { ok: false, error: "Tag no longer exists" };
  }

  if (parsed.data.entity === "task") {
    const task = await getTask(userId, id);
    if (!task) return { ok: false, error: "Not found" };
    const applied = !task.tagIds.includes(tag);
    const tagIds = applied
      ? [...task.tagIds, tag]
      : task.tagIds.filter((x) => x !== tag);
    const lifeArea = deriveLifeAreaFromTags(tagIds, tags, task.lifeArea);
    await updateTask(userId, id, { tagIds, lifeArea });
    revalidatePath("/", "layout");
    return { ok: true, data: { applied } };
  }

  const note = await getNote(userId, id);
  if (!note) return { ok: false, error: "Not found" };
  const applied = !note.tagIds.includes(tag);
  const tagIds = applied
    ? [...note.tagIds, tag]
    : note.tagIds.filter((x) => x !== tag);
  const lifeArea = deriveLifeAreaFromTags(tagIds, tags, note.lifeArea);
  const { today: updatedAt } = await userToday();
  await updateNote(userId, id, { tagIds, lifeArea, updatedAt });
  revalidatePath("/", "layout");
  return { ok: true, data: { applied } };
}

const updateTagSchema = z
  .object({
    id: entityId,
    name: tagName.optional(),
    color: cssColor.optional(),
  })
  .strict();

export async function updateTagAction(input: {
  id: string;
  name?: string;
  color?: string;
}): Promise<ActionResult<Tag>> {
  const parsed = updateTagSchema.safeParse({
    ...input,
    ...(input.name !== undefined ? { name: input.name.toLowerCase() } : {}),
  });
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const { id, ...patch } = parsed.data;
  if (!Object.keys(patch).length) return { ok: false, error: "Nothing to update" };

  const userId = await requireUserId();
  const updated = await updateTag(userId, id, patch);
  if (!updated) {
    return { ok: false, error: patch.name ? "Name already in use" : "Not found" };
  }
  revalidatePath("/", "layout");
  return { ok: true, data: updated };
}

export async function deleteTagAction(id: string): Promise<ActionResult> {
  const parsed = entityId.safeParse(id);
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  const userId = await requireUserId();
  const tags = await listTags(userId);
  const tag = tags.find((t) => t.id === parsed.data);
  if (!tag) return { ok: false, error: "Not found" };
  if (tag.isDefault) {
    return { ok: false, error: "Default tags can't be deleted" };
  }

  // Detaches the tag from all tasks/notes, then removes it.
  await deleteTag(userId, parsed.data);
  revalidatePath("/", "layout");
  return { ok: true };
}
