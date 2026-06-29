import { getDb } from "@/lib/mongodb";
import { newId } from "@/lib/store/memory";
import { toDto, type HabitEntry, habitEntrySchema } from "@/lib/schemas";
import type { HabitEntryDoc } from "@/lib/schemas";

async function col() {
  const db = await getDb();
  return db.collection<HabitEntryDoc>("habitEntries");
}

export async function listHabitEntries(): Promise<HabitEntry[]> {
  const c = await col();
  const docs = await c.find({}).toArray();
  return docs.map((e) => toDto(habitEntrySchema.parse(e)));
}

export async function toggleHabitEntry(
  habitId: string,
  date: string
): Promise<boolean> {
  const c = await col();
  const existing = await c.findOne({ habitId, date });
  if (existing) {
    await c.deleteOne({ _id: existing._id });
    return false;
  }
  await c.insertOne({ _id: newId(), habitId, date, done: true });
  return true;
}
