"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/types";
import { iso } from "@/lib/date";
import { getTask, updateTask } from "@/lib/db/tasks";
import { getNote, updateNote } from "@/lib/db/notes";

export type TaggableEntity = "task" | "note";

export async function toggleEntityTag(
  entity: TaggableEntity,
  entityId: string,
  tagId: string
): Promise<ActionResult<{ applied: boolean }>> {
  if (entity === "task") {
    const task = await getTask(entityId);
    if (!task) return { ok: false, error: "Not found" };
    const applied = !task.tagIds.includes(tagId);
    const tagIds = applied
      ? [...task.tagIds, tagId]
      : task.tagIds.filter((id) => id !== tagId);
    await updateTask(entityId, { tagIds });
    revalidatePath("/", "layout");
    return { ok: true, data: { applied } };
  }

  const note = await getNote(entityId);
  if (!note) return { ok: false, error: "Not found" };
  const applied = !note.tagIds.includes(tagId);
  const tagIds = applied
    ? [...note.tagIds, tagId]
    : note.tagIds.filter((id) => id !== tagId);
  await updateNote(entityId, { tagIds, updatedAt: iso() });
  revalidatePath("/", "layout");
  return { ok: true, data: { applied } };
}
