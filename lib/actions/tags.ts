"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/types";
import type { Tag } from "@/lib/schemas";
import { userToday } from "@/lib/timezone-server";
import { requireUserId } from "@/lib/auth/session";
import { getTask, updateTask } from "@/lib/db/tasks";
import { getNote, updateNote } from "@/lib/db/notes";
import { deleteTag, listTags, restoreTags, updateTag } from "@/lib/db/tags";
import { listTasks } from "@/lib/db/tasks";
import { listNotes } from "@/lib/db/notes";
import { getSettings, updateSettings } from "@/lib/db/settings";
import type { TagDoc } from "@/lib/schemas";
import { cssColor, entityId, tagName } from "@/lib/validation";
import {
  deriveLifeAreaFromTags,
  isLifeTag,
  hasLifeTag,
} from "@/lib/life-area-sync";
import {
  projectIdFromTags,
  withSingleProjectTag,
} from "@/lib/project-tags";
import { syncGoalsForProject } from "@/lib/goal-sync-server";

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

  const tagRecord = tags.find((t) => t.id === tag)!;

  if (parsed.data.entity === "task") {
    const task = await getTask(userId, id);
    if (!task) return { ok: false, error: "Not found" };
    const applied = !task.tagIds.includes(tag);
    let tagIds = applied
      ? [...task.tagIds, tag]
      : task.tagIds.filter((x) => x !== tag);

    // Everything belongs to a life area, so the last one can't come off —
    // switch to the other instead.
    if (!applied && isLifeTag(tagRecord.name) && !hasLifeTag(tagIds, tags)) {
      return {
        ok: false,
        error: `Pick ${tagRecord.name === "work" ? "personal" : "work"} first — everything belongs to one side or both`,
      };
    }

    // Project tags file the task. A task belongs to one project, so adding a
    // second project's tag replaces the first rather than stacking.
    const nextProjectId = projectIdFromTags(tagIds, tags);
    tagIds = withSingleProjectTag(tagIds, nextProjectId, tags);

    const lifeArea = deriveLifeAreaFromTags(tagIds, tags);
    const previousProjectId = task.projectId;
    await updateTask(userId, id, {
      tagIds,
      lifeArea,
      projectId: nextProjectId,
    });

    // Project progress counts its tasks, and this just moved one.
    if (previousProjectId && previousProjectId !== nextProjectId) {
      await syncGoalsForProject(userId, previousProjectId);
    }
    if (nextProjectId && nextProjectId !== previousProjectId) {
      await syncGoalsForProject(userId, nextProjectId);
    }

    revalidatePath("/", "layout");
    return { ok: true, data: { applied } };
  }

  const note = await getNote(userId, id);
  if (!note) return { ok: false, error: "Not found" };
  const applied = !note.tagIds.includes(tag);
  const tagIds = applied
    ? [...note.tagIds, tag]
    : note.tagIds.filter((x) => x !== tag);

  if (!applied && isLifeTag(tagRecord.name) && !hasLifeTag(tagIds, tags)) {
    return {
      ok: false,
      error: `Pick ${tagRecord.name === "work" ? "personal" : "work"} first — everything belongs to one side or both`,
    };
  }
  const lifeArea = deriveLifeAreaFromTags(tagIds, tags);
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
  if (patch.name !== undefined) {
    const all = await listTags(userId);
    const existing = all.find((t) => t.id === id);
    // The derivation matches life tags by name, so a rename would silently
    // orphan every item carrying it. Recolouring is fine.
    if (existing && isLifeTag(existing.name)) {
      return { ok: false, error: `"${existing.name}" is a life tag and can't be renamed` };
    }
    // One namespace for ordinary and project tags alike, so "#ai" is never
    // ambiguous about where it files things.
    const clash = all.find(
      (t) => t.id !== id && t.name.toLowerCase() === patch.name!.toLowerCase()
    );
    if (clash) {
      return {
        ok: false,
        error: clash.projectId
          ? `"${patch.name}" is already a project tag`
          : `"${patch.name}" is already in use`,
      };
    }
  }
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
  // personal/work aren't labels, they're the life area itself — removing one
  // would leave everything carrying it with nowhere to belong.
  if (isLifeTag(tag.name)) {
    return { ok: false, error: `"${tag.name}" is a life tag and can't be deleted` };
  }
  if (tag.isProjectPrimary) {
    return {
      ok: false,
      error: "That's the project's own tag — rename it, or delete the project",
    };
  }
  if (tag.isDefault) {
    return { ok: false, error: "Default tags can't be deleted" };
  }

  // Detaches the tag from all tasks/notes, then removes it.
  await deleteTag(userId, parsed.data);
  revalidatePath("/", "layout");
  return { ok: true };
}


/** A tag is unused when nothing references it. Default tags are never swept. */
async function findUnusedTags(userId: string) {
  const [tags, tasks, notes] = await Promise.all([
    listTags(userId),
    listTasks(userId),
    listNotes(userId),
  ]);
  const used = new Set<string>();
  for (const t of tasks) for (const id of t.tagIds) used.add(id);
  for (const n of notes) for (const id of n.tagIds) used.add(id);
  return tags.filter(
    (t) => !t.isDefault && !isLifeTag(t.name) && !used.has(t.id)
  );
}

/** Rebuild the storable doc from a DTO so an undo can restore it verbatim. */
function toTagDoc(tag: Tag, userId: string): TagDoc {
  return {
    _id: tag.id,
    userId,
    name: tag.name,
    color: tag.color,
    isDefault: tag.isDefault,
    projectId: null,
    isProjectPrimary: false,
    order: tag.order,
    createdAt: tag.createdAt,
  };
}

/**
 * Delete every tag nothing is using. Returns the removed tags as the undo
 * snapshot so the toast can put them back exactly as they were.
 */
export async function cleanUnusedTagsAction(): Promise<
  ActionResult<{ removed: number; names: string[] }>
> {
  const userId = await requireUserId();
  const unused = await findUnusedTags(userId);
  if (!unused.length) {
    return { ok: true, data: { removed: 0, names: [] } };
  }

  const snapshot = unused.map((t) => toTagDoc(t, userId));
  for (const tag of unused) await deleteTag(userId, tag.id);

  revalidatePath("/", "layout");
  return {
    ok: true,
    data: { removed: unused.length, names: unused.map((t) => t.name) },
    undo: { type: "delete", entity: "tag", snapshot },
  };
}

/** Undo a cleanup — restores the exact tags (same ids, colors, order). */
export async function restoreTagsAction(
  snapshot: unknown
): Promise<ActionResult<{ restored: number }>> {
  const userId = await requireUserId();
  if (!Array.isArray(snapshot)) return { ok: false, error: "Invalid snapshot" };
  // Force ownership: a snapshot is client-echoed, so never trust its userId.
  const docs = snapshot
    .filter((d): d is TagDoc => Boolean(d) && typeof d === "object")
    .map((d) => ({ ...d, userId }));
  const restored = await restoreTags(userId, docs);
  revalidatePath("/", "layout");
  return { ok: true, data: { restored } };
}

/**
 * The opt-in sweep. Runs at most once a day per account and only removes tags
 * that have been unused AND untouched for the configured number of days — the
 * age check keeps a tag you just made from vanishing before you use it.
 */
export async function maybeAutoCleanTagsAction(): Promise<
  ActionResult<{ removed: number }>
> {
  const userId = await requireUserId();
  const settings = await getSettings(userId);
  if (!settings?.tagAutoClean) return { ok: true, data: { removed: 0 } };

  const now = Date.now();
  const last = settings.tagsCleanedAt ? Date.parse(settings.tagsCleanedAt) : 0;
  if (Number.isFinite(last) && now - last < 24 * 60 * 60 * 1000) {
    return { ok: true, data: { removed: 0 } };
  }

  const cutoffMs = now - (settings.tagAutoCleanDays ?? 30) * 24 * 60 * 60 * 1000;
  const unused = (await findUnusedTags(userId)).filter((t) => {
    const created = Date.parse(t.createdAt);
    return Number.isFinite(created) ? created < cutoffMs : false;
  });

  for (const tag of unused) await deleteTag(userId, tag.id);
  await updateSettings(userId, { tagsCleanedAt: new Date(now).toISOString() });

  if (unused.length) revalidatePath("/", "layout");
  return { ok: true, data: { removed: unused.length } };
}
