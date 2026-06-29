"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/types";
import { getCurrentUserId } from "@/lib/store/memory";
import { iso } from "@/lib/date";
import { parseOmni, defaultDue, parseNoteCapture } from "@/lib/parse";
import { listTags, ensureTags } from "@/lib/db/tags";
import { insertTask, updateTask, deleteTask as removeTask } from "@/lib/db/tasks";
import { insertNote } from "@/lib/db/notes";
import { insertHabit } from "@/lib/db/habits";
import { insertGoal, listGoals, nextGoalOrder } from "@/lib/db/goals";
import { getSettings } from "@/lib/db/settings";
import { userToday } from "@/lib/timezone-server";
import type { Task } from "@/lib/schemas";
import { syncGoalsForProject } from "@/lib/goal-sync-server";

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
  const userId = getCurrentUserId();
  const settings = await getSettings(userId);
  const tags = await listTags();
  const { timeZone, today: td } = await userToday();
  const p = parseOmni(text, tags, undefined, undefined, timeZone);
  const newTagIds = await ensureTags(p.newTagNames);
  const tagIds = [...new Set([...(pickedTagIds ?? []), ...p.tagIds, ...newTagIds])];
  const title = p.title || text.trim();

  const area = lifeArea ?? "personal";

  if (type === "task") {
    const due =
      p.due ?? dueOverride ?? defaultDue(null, settings?.defaultDueToday ?? true, td);
    const task = await insertTask({
      userId,
      title,
      tagIds,
      priority: p.priority,
      status: "todo",
      due,
      projectId: projectId ?? null,
      goalId: null,
      lifeArea: area,
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
      lifeArea: area,
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

  const userId = getCurrentUserId();
  const tags = await listTags();
  const { timeZone, today: td } = await userToday();
  const p = parseOmni(parsed.data.text, tags, undefined, undefined, timeZone);
  const newTagIds = await ensureTags(p.newTagNames);
  const tagIds = [...new Set([...p.tagIds, ...newTagIds])];
  const task = await insertTask({
    userId,
    title: p.title,
    tagIds,
    priority: p.priority,
    status: "todo",
    due: parsed.data.due ?? p.due ?? td,
    projectId: parsed.data.projectId ?? null,
    goalId: null,
    lifeArea: parsed.data.lifeArea ?? "personal",
    order: -Date.now(),
    createdAt: td,
    completedAt: null,
  });
  revalidatePath("/", "layout");
  return { ok: true, data: task, undo: { type: "create", entity: "task", snapshot: task.id } };
}

export async function toggleTask(id: string): Promise<ActionResult> {
  const { getTask } = await import("@/lib/db/tasks");
  const task = await getTask(id);
  if (!task) return { ok: false, error: "Not found" };
  const { today: td } = await userToday();
  const done = task.status !== "done";
  await updateTask(id, {
    status: done ? "done" : "todo",
    completedAt: done ? td : null,
  });
  if (task.projectId) await syncGoalsForProject(task.projectId);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function cycleTaskPriority(id: string): Promise<ActionResult> {
  const { getTask } = await import("@/lib/db/tasks");
  const task = await getTask(id);
  if (!task) return { ok: false, error: "Not found" };
  const order = ["low", "med", "high"] as const;
  const next = order[(order.indexOf(task.priority) + 1) % 3];
  await updateTask(id, { priority: next });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function renameTask(id: string, title: string): Promise<ActionResult> {
  if (!title.trim()) return { ok: false, error: "Empty title" };
  await updateTask(id, { title: title.trim() });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteTaskAction(id: string): Promise<ActionResult> {
  const { getTask } = await import("@/lib/db/tasks");
  const task = await getTask(id);
  if (!task) return { ok: false, error: "Not found" };
  await removeTask(id);
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
  const { getTask } = await import("@/lib/db/tasks");
  const task = await getTask(id);
  if (!task) return { ok: false, error: "Not found" };
  const { today: td } = await userToday();
  await updateTask(id, {
    status,
    completedAt: status === "done" ? td : null,
  });
  if (task.projectId) await syncGoalsForProject(task.projectId);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function undoCreate(entity: string, id: string): Promise<ActionResult> {
  if (entity === "task") await removeTask(id);
  else if (entity === "note") {
    const { deleteNote } = await import("@/lib/db/notes");
    await deleteNote(id);
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function undoDeleteTask(snapshot: string): Promise<ActionResult> {
  const task = JSON.parse(snapshot);
  await insertTask({ ...task, _id: task.id });
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

  const { getTask } = await import("@/lib/db/tasks");
  const existing = await getTask(id);
  if (!existing) return { ok: false, error: "Not found" };

  const normalized = {
    ...patch,
    ...(patch.due !== undefined
      ? { due: patch.due === "" ? null : patch.due }
      : {}),
  };

  const updated = await updateTask(id, normalized);
  if (!updated) return { ok: false, error: "Not found" };

  if (existing.projectId) await syncGoalsForProject(existing.projectId);
  revalidatePath("/", "layout");
  return { ok: true, data: updated };
}
