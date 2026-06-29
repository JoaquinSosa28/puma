import { getStore, getCurrentUserId, newId } from "@/lib/store/memory";
import { toDto, type LifeWeek, lifeWeekSchema } from "@/lib/schemas";
import { iso } from "@/lib/date";

export async function listLifeWeeks(
  userId = getCurrentUserId()
): Promise<LifeWeek[]> {
  const store = getStore();
  return store.lifeWeeks
    .filter((w) => w.userId === userId)
    .map((w) => toDto(lifeWeekSchema.parse(w)));
}

export async function getLifeWeek(
  weekStart: string,
  userId = getCurrentUserId()
): Promise<LifeWeek | null> {
  const store = getStore();
  const key = weekStart.slice(0, 10);
  const doc = store.lifeWeeks.find(
    (w) => w.userId === userId && w.weekStart === key
  );
  return doc ? toDto(lifeWeekSchema.parse(doc)) : null;
}

export async function upsertLifeWeek(
  doc: Omit<import("@/lib/schemas").LifeWeekDoc, "_id" | "updatedAt"> & {
    _id?: string;
  }
): Promise<LifeWeek> {
  const store = getStore();
  const weekStart = doc.weekStart.slice(0, 10);
  const idx = store.lifeWeeks.findIndex(
    (w) => w.userId === doc.userId && w.weekStart === weekStart
  );
  const updatedAt = iso();
  const full = {
    ...doc,
    weekStart,
    _id: doc._id ?? (idx >= 0 ? store.lifeWeeks[idx]._id : newId()),
    updatedAt,
  };
  if (idx >= 0) {
    store.lifeWeeks[idx] = full as import("@/lib/schemas").LifeWeekDoc;
  } else {
    store.lifeWeeks.push(full as import("@/lib/schemas").LifeWeekDoc);
  }
  return toDto(lifeWeekSchema.parse(full));
}

export async function removeLifeWeeksByDates(
  userId: string,
  dates: string[]
): Promise<void> {
  if (!dates.length) return;
  const store = getStore();
  const keys = new Set(dates.map((d) => d.slice(0, 10)));
  store.lifeWeeks = store.lifeWeeks.filter(
    (w) => !(w.userId === userId && keys.has(w.weekStart))
  );
}
