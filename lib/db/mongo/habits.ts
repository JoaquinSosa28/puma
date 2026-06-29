import { getDb } from "@/lib/mongodb";
import { getCurrentUserId, newId } from "@/lib/store/memory";
import { toDto, type Habit, habitSchema } from "@/lib/schemas";
import type { HabitDoc } from "@/lib/schemas";

async function col() {
  const db = await getDb();
  return db.collection<HabitDoc>("habits");
}

export async function listHabits(userId = getCurrentUserId()): Promise<Habit[]> {
  const c = await col();
  const docs = await c.find({ userId }).sort({ order: 1 }).toArray();
  return docs.map((h) => toDto(habitSchema.parse(h)));
}

export async function insertHabit(
  doc: Omit<HabitDoc, "_id"> & { _id?: string }
): Promise<Habit> {
  const c = await col();
  const full = { ...doc, _id: doc._id ?? newId() } as HabitDoc;
  await c.insertOne(full);
  return toDto(habitSchema.parse(full));
}

export async function updateHabit(
  id: string,
  patch: Partial<HabitDoc>
): Promise<Habit | null> {
  const c = await col();
  const doc = await c.findOneAndUpdate(
    { _id: id },
    { $set: patch },
    { returnDocument: "after" }
  );
  return doc ? toDto(habitSchema.parse(doc)) : null;
}
