import { getDb } from "@/lib/mongodb";
import { getCurrentUserId, newId } from "@/lib/store/memory";
import { toDto, type Task, taskSchema } from "@/lib/schemas";
import type { Subtask, TaskDoc } from "@/lib/schemas";

async function col() {
  const db = await getDb();
  return db.collection<TaskDoc>("tasks");
}

export async function listTasks(userId = getCurrentUserId()): Promise<Task[]> {
  const c = await col();
  // createdAt desc approximates the memory store's unshift (newest first);
  // order asc keeps same-day seed tasks stable. UI re-sorts where it matters.
  const docs = await c.find({ userId }).sort({ createdAt: -1, order: 1 }).toArray();
  return docs.map((t) => toDto(taskSchema.parse(t)));
}

export async function getTask(id: string): Promise<Task | null> {
  const c = await col();
  const doc = await c.findOne({ _id: id });
  return doc ? toDto(taskSchema.parse(doc)) : null;
}

export async function getTasksByDue(
  date: string,
  userId = getCurrentUserId()
): Promise<Task[]> {
  const tasks = await listTasks(userId);
  return tasks.filter((t) => (t.due ?? "").slice(0, 10) === date);
}

export async function getCarryoverTasks(
  today: string,
  userId = getCurrentUserId()
): Promise<Task[]> {
  const tasks = await listTasks(userId);
  return tasks.filter(
    (t) =>
      t.status !== "done" &&
      (t.due ?? "").slice(0, 10) < today &&
      (t.due ?? "") !== ""
  );
}

export async function getTasksByProject(
  projectId: string,
  userId = getCurrentUserId()
): Promise<Task[]> {
  const tasks = await listTasks(userId);
  return tasks.filter((t) => t.projectId === projectId);
}

export async function insertTask(
  doc: Omit<
    TaskDoc,
    "_id" | "timeSpentSec" | "timerStartedAt" | "description" | "subtasks"
  > & {
    _id?: string;
    timeSpentSec?: number;
    timerStartedAt?: string | null;
    description?: string;
    subtasks?: Subtask[];
  }
): Promise<Task> {
  const c = await col();
  const full: TaskDoc = {
    description: "",
    subtasks: [],
    timeSpentSec: 0,
    timerStartedAt: null,
    ...doc,
    _id: doc._id ?? newId(),
  } as TaskDoc;
  await c.insertOne(full);
  return toDto(taskSchema.parse(full));
}

export async function updateTask(
  id: string,
  patch: Partial<TaskDoc>
): Promise<Task | null> {
  const c = await col();
  const doc = await c.findOneAndUpdate(
    { _id: id },
    { $set: patch },
    { returnDocument: "after" }
  );
  return doc ? toDto(taskSchema.parse(doc)) : null;
}

export async function getRunningTimerTask(
  userId = getCurrentUserId()
): Promise<Task | null> {
  const tasks = await listTasks(userId);
  return tasks.find((t) => t.timerStartedAt) ?? null;
}

async function accumulateRunningTime(task: Task): Promise<number> {
  if (!task.timerStartedAt) return task.timeSpentSec;
  const elapsed = Math.floor(
    (Date.now() - new Date(task.timerStartedAt).getTime()) / 1000
  );
  return task.timeSpentSec + Math.max(0, elapsed);
}

export async function stopRunningTimers(
  exceptId?: string,
  userId = getCurrentUserId()
): Promise<void> {
  const tasks = await listTasks(userId);
  for (const task of tasks) {
    if (!task.timerStartedAt || task.id === exceptId) continue;
    const timeSpentSec = await accumulateRunningTime(task);
    await updateTask(task.id, { timeSpentSec, timerStartedAt: null });
  }
}

export { accumulateRunningTime };

export async function deleteTask(id: string): Promise<boolean> {
  const c = await col();
  const res = await c.deleteOne({ _id: id });
  return res.deletedCount > 0;
}
