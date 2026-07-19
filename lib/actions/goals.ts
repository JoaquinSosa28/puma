"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/types";
import { requireUserId } from "@/lib/auth/session";
import { userToday } from "@/lib/timezone-server";
import { entityId, isoDate, shortText, title } from "@/lib/validation";
import {
  deleteGoal,
  insertGoal,
  listGoals,
  nextGoalOrder,
  updateGoal,
  updateGoalsLayout,
} from "@/lib/db/goals";
import type { GoalCategory } from "@/lib/types";

const goalCategory = z.enum(["personal", "professional"]);

const addGoalSchema = z.object({ category: goalCategory, title });

export async function addGoalAction(
  category: GoalCategory,
  rawTitle: string
): Promise<ActionResult> {
  const parsed = addGoalSchema.safeParse({ category, title: rawTitle });
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const userId = await requireUserId();
  const { today: createdAt } = await userToday();
  const existing = await listGoals(userId);
  await insertGoal({
    userId,
    title: parsed.data.title,
    category: parsed.data.category,
    metricLabel: "",
    progress: 0,
    targetDate: null,
    lifeArea: "personal",
    order: nextGoalOrder(existing, parsed.data.category),
    createdAt,
  });
  revalidatePath("/", "layout");
  return { ok: true };
}

const progressSchema = z.object({
  id: entityId,
  delta: z.number().int().min(-100).max(100),
});

export async function setGoalProgress(
  id: string,
  delta: number
): Promise<ActionResult> {
  const parsed = progressSchema.safeParse({ id, delta });
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const userId = await requireUserId();
  const goals = await listGoals(userId);
  const g = goals.find((x) => x.id === parsed.data.id);
  if (!g) return { ok: false, error: "Not found" };
  await updateGoal(userId, parsed.data.id, {
    progress: Math.max(0, Math.min(100, g.progress + parsed.data.delta)),
  });
  revalidatePath("/", "layout");
  return { ok: true };
}

const renameSchema = z.object({ id: entityId, title });

export async function renameGoal(
  id: string,
  rawTitle: string
): Promise<ActionResult> {
  const parsed = renameSchema.safeParse({ id, title: rawTitle });
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const userId = await requireUserId();
  await updateGoal(userId, parsed.data.id, { title: parsed.data.title });
  revalidatePath("/", "layout");
  return { ok: true };
}

const detailSchema = z
  .object({
    id: entityId,
    title: title.optional(),
    targetDate: isoDate.nullable().optional(),
    metricLabel: shortText.optional(),
  })
  .strict();

export async function updateGoalDetailAction(input: {
  id: string;
  title?: string;
  targetDate?: string | null;
  metricLabel?: string;
}): Promise<ActionResult> {
  const parsed = detailSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const { id, ...patch } = parsed.data;
  if (!Object.keys(patch).length) return { ok: false, error: "Nothing to update" };

  const userId = await requireUserId();
  const updated = await updateGoal(userId, id, patch);
  if (!updated) return { ok: false, error: "Not found" };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteGoalAction(id: string): Promise<ActionResult> {
  const parsed = entityId.safeParse(id);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const userId = await requireUserId();
  // Unlinks projects/tasks/habits pointing at the goal, then removes it.
  const deleted = await deleteGoal(userId, parsed.data);
  if (!deleted) return { ok: false, error: "Not found" };
  revalidatePath("/", "layout");
  return { ok: true };
}

const layoutSchema = z.object({
  personalIds: z.array(entityId).max(500),
  professionalIds: z.array(entityId).max(500),
});

export async function updateGoalsLayoutAction(
  personalIds: string[],
  professionalIds: string[]
): Promise<ActionResult> {
  const parsed = layoutSchema.safeParse({ personalIds, professionalIds });
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const userId = await requireUserId();
  await updateGoalsLayout(userId, [
    { category: "personal", ids: parsed.data.personalIds },
    { category: "professional", ids: parsed.data.professionalIds },
  ]);
  revalidatePath("/", "layout");
  return { ok: true };
}

const moveSchema = z.object({ id: entityId, category: goalCategory });

export async function moveGoalCategoryAction(
  id: string,
  category: GoalCategory
): Promise<ActionResult> {
  const parsed = moveSchema.safeParse({ id, category });
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const userId = await requireUserId();
  const goals = await listGoals(userId);
  const goal = goals.find((g) => g.id === parsed.data.id);
  if (!goal) return { ok: false, error: "Not found" };
  if (goal.category === parsed.data.category) return { ok: true };

  await updateGoal(userId, parsed.data.id, {
    category: parsed.data.category,
    order: nextGoalOrder(goals, parsed.data.category),
  });
  revalidatePath("/", "layout");
  return { ok: true };
}

const reorderSchema = z.object({
  id: entityId,
  direction: z.enum(["up", "down"]),
});

export async function reorderGoalAction(
  id: string,
  direction: "up" | "down"
): Promise<ActionResult> {
  const parsed = reorderSchema.safeParse({ id, direction });
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const userId = await requireUserId();
  const goals = await listGoals(userId);
  const goal = goals.find((g) => g.id === parsed.data.id);
  if (!goal) return { ok: false, error: "Not found" };

  const inCategory = goals.filter((g) => g.category === goal.category);
  const index = inCategory.findIndex((g) => g.id === parsed.data.id);
  const swapIndex = parsed.data.direction === "up" ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= inCategory.length) return { ok: true };

  const other = inCategory[swapIndex];
  await updateGoal(userId, parsed.data.id, { order: other.order });
  await updateGoal(userId, other.id, { order: goal.order });
  revalidatePath("/", "layout");
  return { ok: true };
}
