"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/types";
import { requireUserId } from "@/lib/auth/session";
import { getTask, updateTask } from "@/lib/db/tasks";
import { getNote, updateNote } from "@/lib/db/notes";
import { listTags } from "@/lib/db/tags";
import { userToday } from "@/lib/timezone-server";
import { entityId } from "@/lib/validation";

const setLifeAreaSchema = z
  .object({
    entity: z.enum(["task", "note"]),
    id: entityId,
    area: z.enum(["personal", "work", "both"]),
  })
  .strict();

/**
 * Manual "move to" from the tag context menu. Sets lifeArea directly and
 * syncs the special work/personal tags to match — but only tags that
 * already exist for this user; we never create them from here (that stays
 * an explicit, separate action).
 */
export async function setEntityLifeArea(
  entity: "task" | "note",
  id: string,
  area: "personal" | "work" | "both"
): Promise<ActionResult> {
  const parsed = setLifeAreaSchema.safeParse({ entity, id, area });
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  const userId = await requireUserId();
  const tags = await listTags(userId);
  const workTag = tags.find((t) => t.name.toLowerCase() === "work");
  const personalTag = tags.find((t) => t.name.toLowerCase() === "personal");
  const wantWork = area === "work" || area === "both";
  const wantPersonal = area === "personal" || area === "both";

  const syncTagIds = (tagIds: string[]): string[] => {
    let next = tagIds;
    if (workTag) {
      next = wantWork
        ? next.includes(workTag.id)
          ? next
          : [...next, workTag.id]
        : next.filter((t) => t !== workTag.id);
    }
    if (personalTag) {
      next = wantPersonal
        ? next.includes(personalTag.id)
          ? next
          : [...next, personalTag.id]
        : next.filter((t) => t !== personalTag.id);
    }
    return next;
  };

  if (parsed.data.entity === "task") {
    const task = await getTask(userId, parsed.data.id);
    if (!task) return { ok: false, error: "Not found" };
    const tagIds = syncTagIds(task.tagIds);
    await updateTask(userId, parsed.data.id, { lifeArea: area, tagIds });
    revalidatePath("/", "layout");
    return { ok: true };
  }

  const note = await getNote(userId, parsed.data.id);
  if (!note) return { ok: false, error: "Not found" };
  const tagIds = syncTagIds(note.tagIds);
  const { today: updatedAt } = await userToday();
  await updateNote(userId, parsed.data.id, { lifeArea: area, tagIds, updatedAt });
  revalidatePath("/", "layout");
  return { ok: true };
}
