import { getDb } from "@/lib/mongodb";
import { getCurrentUserId } from "@/lib/store/memory";
import { toDto, type Settings, settingsSchema } from "@/lib/schemas";
import type { SettingsDoc } from "@/lib/schemas";

async function col() {
  const db = await getDb();
  return db.collection<SettingsDoc>("settings");
}

export async function getSettings(
  userId = getCurrentUserId()
): Promise<Settings | null> {
  const c = await col();
  const doc = await c.findOne({ userId });
  return doc ? toDto(settingsSchema.parse(doc)) : null;
}

export async function updateSettings(
  userId: string,
  patch: Partial<SettingsDoc>
): Promise<Settings | null> {
  const c = await col();
  const doc = await c.findOneAndUpdate(
    { userId },
    { $set: patch },
    { returnDocument: "after" }
  );
  return doc ? toDto(settingsSchema.parse(doc)) : null;
}
