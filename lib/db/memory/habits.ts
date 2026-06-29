import { getStore, getCurrentUserId } from "@/lib/store/memory";
import { newId } from "@/lib/store/memory";
import { toDto, type Habit, habitSchema } from "@/lib/schemas";

export async function listHabits(userId = getCurrentUserId()): Promise<Habit[]> {
  const store = getStore();
  return store.habits
    .filter((h) => h.userId === userId)
    .sort((a, b) => a.order - b.order)
    .map((h) => toDto(habitSchema.parse(h)));
}

export async function insertHabit(
  doc: Omit<import("@/lib/schemas").HabitDoc, "_id"> & { _id?: string }
): Promise<Habit> {
  const store = getStore();
  const full = { ...doc, _id: doc._id ?? newId() };
  store.habits.push(full as import("@/lib/schemas").HabitDoc);
  return toDto(habitSchema.parse(full));
}

export async function updateHabit(
  id: string,
  patch: Partial<import("@/lib/schemas").HabitDoc>
): Promise<Habit | null> {
  const store = getStore();
  const idx = store.habits.findIndex((h) => h._id === id);
  if (idx < 0) return null;
  store.habits[idx] = { ...store.habits[idx], ...patch };
  return toDto(habitSchema.parse(store.habits[idx]));
}
