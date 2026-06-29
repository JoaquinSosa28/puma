import { getStore, getCurrentUserId } from "@/lib/store/memory";
import { toDto, type User, userSchema } from "@/lib/schemas";

export async function getCurrentUser(): Promise<User | null> {
  const store = getStore();
  const userId = getCurrentUserId();
  const doc = store.users.find((u) => u._id === userId);
  return doc ? toDto(userSchema.parse(doc)) : null;
}

export async function updateUser(
  userId: string,
  patch: Partial<Pick<import("@/lib/schemas").UserDoc, "name" | "email">>
): Promise<User | null> {
  const store = getStore();
  const idx = store.users.findIndex((u) => u._id === userId);
  if (idx < 0) return null;
  store.users[idx] = { ...store.users[idx], ...patch };
  return toDto(userSchema.parse(store.users[idx]));
}
