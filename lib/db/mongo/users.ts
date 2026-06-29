import { getDb } from "@/lib/mongodb";
import { getCurrentUserId } from "@/lib/store/memory";
import { toDto, type User, userSchema } from "@/lib/schemas";
import type { UserDoc } from "@/lib/schemas";

async function col() {
  const db = await getDb();
  return db.collection<UserDoc>("users");
}

export async function getCurrentUser(): Promise<User | null> {
  const c = await col();
  const doc = await c.findOne({ _id: getCurrentUserId() });
  return doc ? toDto(userSchema.parse(doc)) : null;
}

export async function updateUser(
  userId: string,
  patch: Partial<Pick<UserDoc, "name" | "email">>
): Promise<User | null> {
  const c = await col();
  const doc = await c.findOneAndUpdate(
    { _id: userId },
    { $set: patch },
    { returnDocument: "after" }
  );
  return doc ? toDto(userSchema.parse(doc)) : null;
}
