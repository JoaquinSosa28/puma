import { getDb } from "@/lib/mongodb";
import { getCurrentUserId, newId } from "@/lib/store/memory";
import { toDto, type LifeWeek, lifeWeekSchema } from "@/lib/schemas";
import type { LifeWeekDoc } from "@/lib/schemas";
import { iso } from "@/lib/date";

async function col() {
  const db = await getDb();
  return db.collection<LifeWeekDoc>("lifeWeeks");
}

export async function listLifeWeeks(
  userId = getCurrentUserId()
): Promise<LifeWeek[]> {
  const c = await col();
  const docs = await c.find({ userId }).toArray();
  return docs.map((w) => toDto(lifeWeekSchema.parse(w)));
}

export async function getLifeWeek(
  weekStart: string,
  userId = getCurrentUserId()
): Promise<LifeWeek | null> {
  const c = await col();
  const doc = await c.findOne({ userId, weekStart: weekStart.slice(0, 10) });
  return doc ? toDto(lifeWeekSchema.parse(doc)) : null;
}

export async function upsertLifeWeek(
  doc: Omit<LifeWeekDoc, "_id" | "updatedAt"> & { _id?: string }
): Promise<LifeWeek> {
  const c = await col();
  const weekStart = doc.weekStart.slice(0, 10);
  const existing = await c.findOne({ userId: doc.userId, weekStart });
  const full = {
    ...doc,
    weekStart,
    _id: doc._id ?? existing?._id ?? newId(),
    updatedAt: iso(),
  } as LifeWeekDoc;
  await c.replaceOne({ _id: full._id }, full, { upsert: true });
  return toDto(lifeWeekSchema.parse(full));
}

export async function removeLifeWeeksByDates(
  userId: string,
  dates: string[]
): Promise<void> {
  if (!dates.length) return;
  const c = await col();
  await c.deleteMany({
    userId,
    weekStart: { $in: dates.map((d) => d.slice(0, 10)) },
  });
}
