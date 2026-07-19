import { getDb } from "@/lib/mongodb";
import { newId } from "@/lib/store/memory";
import { toDto, type Habit, habitSchema } from "@/lib/schemas";
import type { HabitDoc, HabitEntryDoc } from "@/lib/schemas";

async function col() {
  const db = await getDb();
  return db.collection<HabitDoc>("habits");
}

export async function listHabits(userId: string): Promise<Habit[]> {
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
  userId: string,
  id: string,
  patch: Partial<HabitDoc>
): Promise<Habit | null> {
  const c = await col();
  const doc = await c.findOneAndUpdate(
    { _id: id, userId },
    { $set: patch },
    { returnDocument: "after" }
  );
  return doc ? toDto(habitSchema.parse(doc)) : null;
}

export async function deleteHabit(userId: string, id: string): Promise<boolean> {
  const db = await getDb();
  // A habit's entries are meaningless without it — remove them too.
  await db
    .collection<HabitEntryDoc>("habitEntries")
    .deleteMany({ userId, habitId: id });
  const res = await (await col()).deleteOne({ _id: id, userId });
  return res.deletedCount > 0;
}
