"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/types";
import { requireUserId } from "@/lib/auth/session";
import { parseOmni, defaultDue, parseNoteCapture } from "@/lib/parse";
import { listTags, ensureTags } from "@/lib/db/tags";
import { insertTask, updateTask, deleteTask as removeTask } from "@/lib/db/tasks";
import { getProject } from "@/lib/db/projects";
import { insertNote } from "@/lib/db/notes";
import { insertHabit } from "@/lib/db/habits";
import { insertGoal, listGoals, nextGoalOrder } from "@/lib/db/goals";
import { getSettings } from "@/lib/db/settings";
import { userToday } from "@/lib/timezone-server";
import type { Task } from "@/lib/schemas";
import { syncGoalsForProject } from "@/lib/goal-sync-server";
import { deriveLifeAreaFromTags } from "@/lib/life-area-sync";

const omniSchema = z.object({
  text: z.string().min(1),
  type: z.enum(["task", "habit", "goal", "note"]),
  projectId: z.string().nullable().optional(),
  due: z.string().nullable().optional(),
  goalCategory: z.enum(["personal", "professional"]).optional(),
  lifeArea: z.enum(["personal", "work"]).optional(),
  tagIds: z.array(z.string()).optional(),
});

export async function createFromOmni(
  input: z.infer<typeof omniSchema>
): Promise<ActionResult<{ id: string; label: string }>> {
  const parsed = omniSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  const { text, type, projectId, due: dueOverride, goalCategory, lifeArea, tagIds: pickedTagIds } =
    parsed.data;
  const userId = await requireUserId();
  const settings = await getSettings(userId);
  const tags = await listTags(userId);
  const { timeZone, today: td } = await userToday();
  const p = parseOmni(text, tags, undefined, undefined, timeZone);
  const newTagIds = await ensureTags(userId, p.newTagNames);
  // A stale client can send ids of tags/projects deleted since its last render —
  // silently drop dead links instead of persisting dangling references.
  const validPickedTagIds = (pickedTagIds ?? []).filter((id) =>
    tags.some((t) => t.id === id)
  );
  const tagIds = [...new Set([...validPickedTagIds, ...p.tagIds, ...newTagIds])];
  const title = p.title || text.trim();

  const area = lifeArea ?? "personal";

  if (type === "task") {
    const due =
      p.due ?? dueOverride ?? defaultDue(null, settings?.defaultDueToday ?? true, td);
    const project = projectId ? await getProject(userId, projectId) : null;
    const task = await insertTask({
      userId,
      title,
      tagIds,
      priority: p.priority,
      status: "todo",
      due,
      projectId: project ? projectId! : null,
      goalId: null,
      lifeArea: deriveLifeAreaFromTags(tagIds, tags, area),
      order: -Date.now(),
      createdAt: td,
      completedAt: null,
    });
    revalidatePath("/", "layout");
    return {
      ok: true,
      data: { id: task.id, label: "Task added" },
      undo: { type: "create", entity: "task", snapshot: task.id },
    };
  }

  if (type === "note") {
    const noteParsed = parseNoteCapture(text, tags, undefined, timeZone);
    const noteTagIds = [
      ...new Set([...(pickedTagIds ?? []), ...noteParsed.tagIds, ...newTagIds]),
    ];
    const note = await insertNote({
      userId,
      title: noteParsed.title,
      body: noteParsed.body,
      tagIds: noteTagIds,
      pinned: false,
      lifeArea: deriveLifeAreaFromTags(noteTagIds, tags, area),
      createdAt: td,
      updatedAt: td,
    });
    revalidatePath("/", "layout");
    return {
      ok: true,
      data: { id: note.id, label: "Note saved" },
      undo: { type: "create", entity: "note", snapshot: note.id },
    };
  }

  if (type === "habit") {
    const habit = await insertHabit({
      userId,
      name: title,
      color: "oklch(0.6 0.13 155)",
      frequency: { type: "daily", target: 1 },
      order: 999,
      archived: false,
      goalIds: [],
      goalTargetStreak: null,
      lifeArea: area,
      createdAt: td,
    });
    revalidatePath("/", "layout");
    return {
      ok: true,
      data: { id: habit.id, label: "Habit created" },
      undo: { type: "create", entity: "habit", snapshot: habit.id },
    };
  }

  const category = goalCategory ?? "personal";
  const existingGoals = await listGoals(userId);
  const goal = await insertGoal({
    userId,
    title,
    category,
    metricLabel: "",
    progress: 0,
    targetDate: p.due,
    lifeArea: area,
    order: nextGoalOrder(existingGoals, category),
    createdAt: td,
  });
  revalidatePath("/", "layout");
  return {
    ok: true,
    data: { id: goal.id, label: "Goal set" },
    undo: { type: "create", entity: "goal", snapshot: goal.id },
  };
}

const addTaskSchema = z.object({
  text: z.string().min(1),
  due: z.string().nullable().optional(),
  projectId: z.string().nullable().optional(),
  lifeArea: z.enum(["personal", "work"]).optional(),
});

export async function addTask(
  input: z.infer<typeof addTaskSchema>
): Promise<ActionResult<Task>> {
  const parsed = addTaskSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  const userId = await requireUserId();
  const tags = await listTags(userId);
  const { timeZone, today: td } = await userToday();
  const p = parseOmni(parsed.data.text, tags, undefined, undefined, timeZone);
  const newTagIds = await ensureTags(userId, p.newTagNames);
  const tagIds = [...new Set([...p.tagIds, ...newTagIds])];
  // Stale clients may still point at a just-deleted project — don't relink it.
  const project = parsed.data.projectId
    ? await getProject(userId, parsed.data.projectId)
    : null;
  const task = await insertTask({
    userId,
    title: p.title,
    tagIds,
    priority: p.priority,
    status: "todo",
    due: parsed.data.due ?? p.due ?? td,
    projectId: project ? parsed.data.projectId! : null,
    goalId: null,
    lifeArea: deriveLifeAreaFromTags(tagIds, tags, parsed.data.lifeArea ?? "personal"),
    order: -Date.now(),
    createdAt: td,
    completedAt: null,
  });
  revalidatePath("/", "layout");
  return { ok: true, data: task, undo: { type: "create", entity: "task", snapshot: task.id } };
}

export async function toggleTask(id: string): Promise<ActionResult> {
  const userId = await requireUserId();
  const { getTask } = await import("@/lib/db/tasks");
  const task = await getTask(userId, id);
  if (!task) return { ok: false, error: "Not found" };
  const { today: td } = await userToday();
  const done = task.status !== "done";
  await updateTask(userId, id, {
    status: done ? "done" : "todo",
    completedAt: done ? td : null,
  });
  if (task.projectId) await syncGoalsForProject(userId, task.projectId);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function cycleTaskPriority(id: string): Promise<ActionResult> {
  const userId = await requireUserId();
  const { getTask } = await import("@/lib/db/tasks");
  const task = await getTask(userId, id);
  if (!task) return { ok: false, error: "Not found" };
  const order = ["low", "med", "high"] as const;
  const next = order[(order.indexOf(task.priority) + 1) % 3];
  await updateTask(userId, id, { priority: next });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function renameTask(id: string, title: string): Promise<ActionResult> {
  if (!title.trim()) return { ok: false, error: "Empty title" };
  const userId = await requireUserId();
  await updateTask(userId, id, { title: title.trim() });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteTaskAction(id: string): Promise<ActionResult> {
  const userId = await requireUserId();
  const { getTask } = await import("@/lib/db/tasks");
  const task = await getTask(userId, id);
  if (!task) return { ok: false, error: "Not found" };
  await removeTask(userId, id);
  revalidatePath("/", "layout");
  return {
    ok: true,
    undo: { type: "delete", entity: "task", snapshot: task },
  };
}

export async function moveTaskStatus(
  id: string,
  status: "todo" | "doing" | "done"
): Promise<ActionResult> {
  const userId = await requireUserId();
  const { getTask } = await import("@/lib/db/tasks");
  const task = await getTask(userId, id);
  if (!task) return { ok: false, error: "Not found" };
  const { today: td } = await userToday();
  await updateTask(userId, id, {
    status,
    completedAt: status === "done" ? td : null,
  });
  if (task.projectId) await syncGoalsForProject(userId, task.projectId);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function undoCreate(entity: string, id: string): Promise<ActionResult> {
  const userId = await requireUserId();
  if (entity === "task") await removeTask(userId, id);
  else if (entity === "note") {
    const { deleteNote } = await import("@/lib/db/notes");
    await deleteNote(userId, id);
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function undoDeleteTask(snapshot: string): Promise<ActionResult> {
  const userId = await requireUserId();
  let task: Task;
  try {
    task = JSON.parse(snapshot);
  } catch {
    return { ok: false, error: "Invalid snapshot" };
  }
  // Linked entities may have been deleted since the snapshot was taken —
  // restore the task without the dead links.
  const [tags, goals] = await Promise.all([listTags(userId), listGoals(userId)]);
  const project = task.projectId ? await getProject(userId, task.projectId) : null;
  await insertTask({
    ...task,
    _id: task.id,
    userId,
    projectId: project ? task.projectId : null,
    goalId: goals.some((g) => g.id === task.goalId) ? task.goalId : null,
    tagIds: (task.tagIds ?? []).filter((id) => tags.some((t) => t.id === id)),
  });
  revalidatePath("/", "layout");
  return { ok: true };
}

const subtaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  done: z.boolean(),
});

const updateTaskDetailSchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  description: z.string().optional(),
  subtasks: z.array(subtaskSchema).optional(),
  tagIds: z.array(z.string()).optional(),
  priority: z.enum(["low", "med", "high"]).optional(),
  due: z.string().nullable().optional(),
});

export async function updateTaskDetail(
  input: z.infer<typeof updateTaskDetailSchema>
): Promise<ActionResult<Task>> {
  const parsed = updateTaskDetailSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  const { id, ...patch } = parsed.data;
  if (!Object.keys(patch).length) return { ok: false, error: "Nothing to update" };

  const userId = await requireUserId();
  const { getTask } = await import("@/lib/db/tasks");
  const existing = await getTask(userId, id);
  if (!existing) return { ok: false, error: "Not found" };

  // Drop tag ids that no longer exist (deleted since the client last rendered).
  let tagPatch: { tagIds: string[]; lifeArea: Task["lifeArea"] } | undefined;
  if (patch.tagIds !== undefined) {
    const tags = await listTags(userId);
    const tagIds = patch.tagIds.filter((tid) => tags.some((t) => t.id === tid));
    tagPatch = {
      tagIds,
      lifeArea: deriveLifeAreaFromTags(tagIds, tags, existing.lifeArea),
    };
  }

  const normalized = {
    ...patch,
    ...(patch.due !== undefined
      ? { due: patch.due === "" ? null : patch.due }
      : {}),
    ...(tagPatch ?? {}),
  };

  const updated = await updateTask(userId, id, normalized);
  if (!updated) return { ok: false, error: "Not found" };

  if (existing.projectId) await syncGoalsForProject(userId, existing.projectId);
  revalidatePath("/", "layout");
  return { ok: true, data: updated };
}
