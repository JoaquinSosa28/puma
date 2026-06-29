import { getDb } from "@/lib/mongodb";
import { getCurrentUserId, newId } from "@/lib/store/memory";
import { toDto, type LifeDay, lifeDaySchema } from "@/lib/schemas";
import type { LifeDayDoc } from "@/lib/schemas";
import { iso } from "@/lib/date";

async function col() {
  const db = await getDb();
  return db.collection<LifeDayDoc>("lifeDays");
}

export async function listLifeDays(
  userId = getCurrentUserId()
): Promise<LifeDay[]> {
  const c = await col();
  const docs = await c.find({ userId }).toArray();
  return docs.map((d) => toDto(lifeDaySchema.parse(d)));
}

export async function getLifeDay(
  date: string,
  userId = getCurrentUserId()
): Promise<LifeDay | null> {
  const c = await col();
  const doc = await c.findOne({ userId, date: date.slice(0, 10) });
  return doc ? toDto(lifeDaySchema.parse(doc)) : null;
}

export async function upsertLifeDay(
  doc: Omit<LifeDayDoc, "_id" | "updatedAt"> & { _id?: string }
): Promise<LifeDay> {
  const c = await col();
  const date = doc.date.slice(0, 10);
  const existing = await c.findOne({ userId: doc.userId, date });
  const full = {
    ...doc,
    date,
    _id: doc._id ?? existing?._id ?? newId(),
    updatedAt: iso(),
  } as LifeDayDoc;
  await c.replaceOne({ _id: full._id }, full, { upsert: true });
  return toDto(lifeDaySchema.parse(full));
}
