"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/types";
import { getProject, updateProject } from "@/lib/db/projects";
import { updateHabit } from "@/lib/db/habits";
import { syncGoalProgress } from "@/lib/goal-sync-server";

const linkSchema = z.object({
  goalId: z.string().nullable(),
});

const habitAttachSchema = z.object({
  goalId: z.string(),
  targetStreak: z.number().int().min(1).max(999).nullable().optional(),
});

export async function linkProjectToGoal(
  projectId: string,
  goalId: string | null
): Promise<ActionResult> {
  const parsed = linkSchema.safeParse({ goalId });
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  const project = await getProject(projectId);
  if (!project) return { ok: false, error: "Project not found" };

  const previousGoalId = project.goalId;
  await updateProject(projectId, { goalId: parsed.data.goalId });

  if (previousGoalId) await syncGoalProgress(previousGoalId);
  if (parsed.data.goalId) await syncGoalProgress(parsed.data.goalId);

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function attachHabitToGoal(
  habitId: string,
  goalId: string,
  targetStreak?: number | null
): Promise<ActionResult> {
  const parsed = habitAttachSchema.safeParse({ goalId, targetStreak });
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  const habits = await import("@/lib/db/habits").then((m) => m.listHabits());
  const habit = habits.find((h) => h.id === habitId);
  if (!habit) return { ok: false, error: "Habit not found" };
  if (habit.goalIds.includes(parsed.data.goalId)) return { ok: true };

  await updateHabit(habitId, {
    goalIds: [...habit.goalIds, parsed.data.goalId],
    goalTargetStreak:
      parsed.data.targetStreak ?? habit.goalTargetStreak ?? 30,
  });

  await syncGoalProgress(parsed.data.goalId);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function detachHabitFromGoal(
  habitId: string,
  goalId: string
): Promise<ActionResult> {
  const habits = await import("@/lib/db/habits").then((m) => m.listHabits());
  const habit = habits.find((h) => h.id === habitId);
  if (!habit) return { ok: false, error: "Habit not found" };

  const nextGoalIds = habit.goalIds.filter((id) => id !== goalId);
  await updateHabit(habitId, {
    goalIds: nextGoalIds,
    goalTargetStreak: nextGoalIds.length ? habit.goalTargetStreak : null,
  });

  await syncGoalProgress(goalId);
  revalidatePath("/", "layout");
  return { ok: true };
}

/** @deprecated use attachHabitToGoal / detachHabitFromGoal */
export async function linkHabitToGoal(
  habitId: string,
  goalId: string | null,
  targetStreak?: number | null
): Promise<ActionResult> {
  if (goalId) return attachHabitToGoal(habitId, goalId, targetStreak);
  const habits = await import("@/lib/db/habits").then((m) => m.listHabits());
  const habit = habits.find((h) => h.id === habitId);
  if (!habit) return { ok: false, error: "Habit not found" };
  const previous = [...habit.goalIds];
  await updateHabit(habitId, { goalIds: [], goalTargetStreak: null });
  for (const id of previous) await syncGoalProgress(id);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateHabitGoalTargetAction(
  habitId: string,
  targetStreak: number
): Promise<ActionResult> {
  if (!Number.isFinite(targetStreak) || targetStreak < 1 || targetStreak > 999) {
    return { ok: false, error: "Invalid streak target" };
  }

  const habits = await import("@/lib/db/habits").then((m) => m.listHabits());
  const habit = habits.find((h) => h.id === habitId);
  if (!habit) return { ok: false, error: "Habit not found" };
  if (!habit.goalIds.length) {
    return { ok: false, error: "Habit is not linked to a goal" };
  }

  await updateHabit(habitId, { goalTargetStreak: Math.round(targetStreak) });
  for (const goalId of habit.goalIds) await syncGoalProgress(goalId);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function refreshGoalProgress(goalId: string): Promise<ActionResult> {
  await syncGoalProgress(goalId);
  revalidatePath("/", "layout");
  return { ok: true };
}
