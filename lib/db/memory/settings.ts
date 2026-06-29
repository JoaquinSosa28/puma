import { getStore, getCurrentUserId } from "@/lib/store/memory";
import { toDto, type Settings, settingsSchema } from "@/lib/schemas";

export async function getSettings(
  userId = getCurrentUserId()
): Promise<Settings | null> {
  const store = getStore();
  const doc = store.settings.find((s) => s.userId === userId);
  return doc ? toDto(settingsSchema.parse(doc)) : null;
}

export async function updateSettings(
  userId: string,
  patch: Partial<import("@/lib/schemas").SettingsDoc>
): Promise<Settings | null> {
  const store = getStore();
  const idx = store.settings.findIndex((s) => s.userId === userId);
  if (idx < 0) return null;
  store.settings[idx] = { ...store.settings[idx], ...patch };
  return toDto(settingsSchema.parse(store.settings[idx]));
}
