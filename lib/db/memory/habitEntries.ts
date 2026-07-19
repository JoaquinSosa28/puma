import { getStore, newId } from "@/lib/store/memory";
import { toDto, type HabitEntry, habitEntrySchema } from "@/lib/schemas";

export async function listHabitEntries(userId: string): Promise<HabitEntry[]> {
  const store = getStore();
  return store.habitEntries
    .filter((e) => e.userId === userId)
    .map((e) => toDto(habitEntrySchema.parse(e)));
}

export async function toggleHabitEntry(
  userId: string,
  habitId: string,
  date: string
): Promise<boolean> {
  const store = getStore();
  const existing = store.habitEntries.find(
    (e) => e.userId === userId && e.habitId === habitId && e.date === date
  );
  if (existing) {
    store.habitEntries = store.habitEntries.filter(
      (e) => !(e.userId === userId && e.habitId === habitId && e.date === date)
    );
    return false;
  }
  store.habitEntries.push({
    _id: newId(),
    userId,
    habitId,
    date,
    done: true,
  });
  return true;
}
