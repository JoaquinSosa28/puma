import { getStore, getCurrentUserId, newId } from "@/lib/store/memory";
import { toDto, type Task, taskSchema } from "@/lib/schemas";

export async function listTasks(userId = getCurrentUserId()): Promise<Task[]> {
  const store = getStore();
  return store.tasks
    .filter((t) => t.userId === userId)
    .map((t) => toDto(taskSchema.parse(t)));
}

export async function getTask(id: string): Promise<Task | null> {
  const store = getStore();
  const doc = store.tasks.find((t) => t._id === id);
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
    import("@/lib/schemas").TaskDoc,
    "_id" | "timeSpentSec" | "timerStartedAt" | "description" | "subtasks"
  > & {
    _id?: string;
    timeSpentSec?: number;
    timerStartedAt?: string | null;
    description?: string;
    subtasks?: import("@/lib/schemas").Subtask[];
  }
): Promise<Task> {
  const store = getStore();
  const full = {
    description: "",
    subtasks: [],
    timeSpentSec: 0,
    timerStartedAt: null,
    ...doc,
    _id: doc._id ?? newId(),
  };
  store.tasks.unshift(full as import("@/lib/schemas").TaskDoc);
  return toDto(taskSchema.parse(full));
}

export async function updateTask(
  id: string,
  patch: Partial<import("@/lib/schemas").TaskDoc>
): Promise<Task | null> {
  const store = getStore();
  const idx = store.tasks.findIndex((t) => t._id === id);
  if (idx < 0) return null;
  store.tasks[idx] = { ...store.tasks[idx], ...patch };
  return toDto(taskSchema.parse(store.tasks[idx]));
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
  const store = getStore();
  const before = store.tasks.length;
  store.tasks = store.tasks.filter((t) => t._id !== id);
  return store.tasks.length < before;
}
