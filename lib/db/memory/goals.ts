import { getStore, getCurrentUserId, newId } from "@/lib/store/memory";
import { toDto, type Goal, goalSchema } from "@/lib/schemas";
import type { GoalCategory } from "@/lib/types";

function sortGoals(docs: import("@/lib/schemas").GoalDoc[]): import("@/lib/schemas").GoalDoc[] {
  return [...docs].sort(
    (a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt)
  );
}

export function nextGoalOrder(
  goals: Goal[],
  category: GoalCategory
): number {
  const inCategory = goals.filter((g) => g.category === category);
  if (!inCategory.length) return 0;
  return Math.max(...inCategory.map((g) => g.order)) + 1;
}

export async function listGoals(userId = getCurrentUserId()): Promise<Goal[]> {
  const store = getStore();
  return sortGoals(store.goals.filter((g) => g.userId === userId)).map((g) =>
    toDto(goalSchema.parse(g))
  );
}

export async function insertGoal(
  doc: Omit<import("@/lib/schemas").GoalDoc, "_id"> & { _id?: string }
): Promise<Goal> {
  const store = getStore();
  const full = { ...doc, _id: doc._id ?? newId() };
  store.goals.unshift(full as import("@/lib/schemas").GoalDoc);
  return toDto(goalSchema.parse(full));
}

export async function updateGoal(
  id: string,
  patch: Partial<import("@/lib/schemas").GoalDoc>
): Promise<Goal | null> {
  const store = getStore();
  const idx = store.goals.findIndex((g) => g._id === id);
  if (idx < 0) return null;
  store.goals[idx] = { ...store.goals[idx], ...patch };
  return toDto(goalSchema.parse(store.goals[idx]));
}

export async function updateGoalsLayout(
  layout: { category: GoalCategory; ids: string[] }[]
): Promise<void> {
  const store = getStore();
  for (const { category, ids } of layout) {
    ids.forEach((id, order) => {
      const idx = store.goals.findIndex((g) => g._id === id);
      if (idx >= 0) {
        store.goals[idx] = { ...store.goals[idx], category, order };
      }
    });
  }
}
