"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/types";
import { getCurrentUserId } from "@/lib/store/memory";
import { userToday } from "@/lib/timezone-server";
import {
  insertGoal,
  listGoals,
  nextGoalOrder,
  updateGoal,
  updateGoalsLayout,
} from "@/lib/db/goals";
import type { GoalCategory } from "@/lib/types";

export async function addGoalAction(
  category: GoalCategory,
  title: string
): Promise<ActionResult> {
  if (!title.trim()) return { ok: false, error: "Empty title" };
  const userId = getCurrentUserId();
  const { today: createdAt } = await userToday();
  const existing = await listGoals(userId);
  await insertGoal({
    userId,
    title: title.trim(),
    category,
    metricLabel: "",
    progress: 0,
    targetDate: null,
    lifeArea: "personal",
    order: nextGoalOrder(existing, category),
    createdAt,
  });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function setGoalProgress(
  id: string,
  delta: number
): Promise<ActionResult> {
  const goals = await listGoals();
  const g = goals.find((x) => x.id === id);
  if (!g) return { ok: false, error: "Not found" };
  await updateGoal(id, {
    progress: Math.max(0, Math.min(100, g.progress + delta)),
  });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function renameGoal(
  id: string,
  title: string
): Promise<ActionResult> {
  if (!title.trim()) return { ok: false, error: "Empty title" };
  await updateGoal(id, { title: title.trim() });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateGoalDetailAction(input: {
  id: string;
  title?: string;
  targetDate?: string | null;
  metricLabel?: string;
}): Promise<ActionResult> {
  const { id, ...patch } = input;
  if (!Object.keys(patch).length) return { ok: false, error: "Nothing to update" };
  if (patch.title !== undefined && !patch.title.trim()) {
    return { ok: false, error: "Empty title" };
  }

  const normalized = {
    ...patch,
    ...(patch.title !== undefined ? { title: patch.title.trim() } : {}),
  };

  const updated = await updateGoal(id, normalized);
  if (!updated) return { ok: false, error: "Not found" };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateGoalsLayoutAction(
  personalIds: string[],
  professionalIds: string[]
): Promise<ActionResult> {
  await updateGoalsLayout([
    { category: "personal", ids: personalIds },
    { category: "professional", ids: professionalIds },
  ]);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function moveGoalCategoryAction(
  id: string,
  category: GoalCategory
): Promise<ActionResult> {
  const goals = await listGoals();
  const goal = goals.find((g) => g.id === id);
  if (!goal) return { ok: false, error: "Not found" };
  if (goal.category === category) return { ok: true };

  await updateGoal(id, {
    category,
    order: nextGoalOrder(goals, category),
  });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function reorderGoalAction(
  id: string,
  direction: "up" | "down"
): Promise<ActionResult> {
  const goals = await listGoals();
  const goal = goals.find((g) => g.id === id);
  if (!goal) return { ok: false, error: "Not found" };

  const inCategory = goals.filter((g) => g.category === goal.category);
  const index = inCategory.findIndex((g) => g.id === id);
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= inCategory.length) return { ok: true };

  const other = inCategory[swapIndex];
  await updateGoal(id, { order: other.order });
  await updateGoal(other.id, { order: goal.order });
  revalidatePath("/", "layout");
  return { ok: true };
}
