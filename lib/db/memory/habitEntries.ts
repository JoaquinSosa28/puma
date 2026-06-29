import { getStore } from "@/lib/store/memory";
import { newId } from "@/lib/store/memory";
import { toDto, type HabitEntry, habitEntrySchema } from "@/lib/schemas";

export async function listHabitEntries(): Promise<HabitEntry[]> {
  const store = getStore();
  return store.habitEntries.map((e) => toDto(habitEntrySchema.parse(e)));
}

export async function toggleHabitEntry(
  habitId: string,
  date: string
): Promise<boolean> {
  const store = getStore();
  const existing = store.habitEntries.find(
    (e) => e.habitId === habitId && e.date === date
  );
  if (existing) {
    store.habitEntries = store.habitEntries.filter(
      (e) => !(e.habitId === habitId && e.date === date)
    );
    return false;
  }
  store.habitEntries.push({
    _id: newId(),
    habitId,
    date,
    done: true,
  });
  return true;
}
