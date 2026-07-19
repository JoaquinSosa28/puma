import { getDb } from "@/lib/mongodb";
import { newId } from "@/lib/store/memory";
import { toDto, type Goal, goalSchema } from "@/lib/schemas";
import type { GoalDoc, HabitDoc, ProjectDoc, TaskDoc } from "@/lib/schemas";
import type { GoalCategory } from "@/lib/types";

async function col() {
  const db = await getDb();
  return db.collection<GoalDoc>("goals");
}

export function nextGoalOrder(goals: Goal[], category: GoalCategory): number {
  const inCategory = goals.filter((g) => g.category === category);
  if (!inCategory.length) return 0;
  return Math.max(...inCategory.map((g) => g.order)) + 1;
}

export async function listGoals(userId: string): Promise<Goal[]> {
  const c = await col();
  const docs = await c
    .find({ userId })
    .sort({ order: 1, createdAt: 1 })
    .toArray();
  return docs.map((g) => toDto(goalSchema.parse(g)));
}

export async function insertGoal(
  doc: Omit<GoalDoc, "_id"> & { _id?: string }
): Promise<Goal> {
  const c = await col();
  const full = { ...doc, _id: doc._id ?? newId() } as GoalDoc;
  await c.insertOne(full);
  return toDto(goalSchema.parse(full));
}

export async function updateGoal(
  userId: string,
  id: string,
  patch: Partial<GoalDoc>
): Promise<Goal | null> {
  const c = await col();
  const doc = await c.findOneAndUpdate(
    { _id: id, userId },
    { $set: patch },
    { returnDocument: "after" }
  );
  return doc ? toDto(goalSchema.parse(doc)) : null;
}

export async function deleteGoal(userId: string, id: string): Promise<boolean> {
  const db = await getDb();
  // Unlink dependents first (no transaction — sequential, same as deleteProject).
  await Promise.all([
    db
      .collection<ProjectDoc>("projects")
      .updateMany({ userId, goalId: id }, { $set: { goalId: null } }),
    db
      .collection<TaskDoc>("tasks")
      .updateMany({ userId, goalId: id }, { $set: { goalId: null } }),
    db
      .collection<HabitDoc>("habits")
      .updateMany({ userId, goalIds: id }, { $pull: { goalIds: id } }),
  ]);
  const res = await (await col()).deleteOne({ _id: id, userId });
  return res.deletedCount > 0;
}

export async function updateGoalsLayout(
  userId: string,
  layout: { category: GoalCategory; ids: string[] }[]
): Promise<void> {
  const c = await col();
  for (const { category, ids } of layout) {
    await Promise.all(
      ids.map((id, order) =>
        c.updateOne({ _id: id, userId }, { $set: { category, order } })
      )
    );
  }
}
