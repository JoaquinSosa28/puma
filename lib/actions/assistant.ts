"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/types";
import type { Goal, Project } from "@/lib/schemas";
import { getCurrentUserId, newId } from "@/lib/store/memory";
import { iso } from "@/lib/date";
import { interpret } from "@/lib/ai/interpret";
import { ask } from "@/lib/ai/ask";
import { planSchema, type PlanGraph, type PlanResult } from "@/lib/ai/plan-schema";
import type { AskResult } from "@/lib/ai/ask-schema";
import { insertGoal, listGoals, nextGoalOrder } from "@/lib/db/goals";
import { insertProject, listProjects } from "@/lib/db/projects";
import { insertHabit } from "@/lib/db/habits";
import { insertTask } from "@/lib/db/tasks";
import { insertNote } from "@/lib/db/notes";
import { ensureTags } from "@/lib/db/tags";
import { pickProjectColor } from "@/lib/project-colors";

const HABIT_COLOR = "oklch(0.6 0.13 155)";

export async function interpretIntent(
  intent: string
): Promise<ActionResult<PlanResult>> {
  const trimmed = intent.trim();
  if (!trimmed) return { ok: false, error: "Describe what you want to plan." };
  try {
    const result = await interpret(trimmed);
    return { ok: true, data: result };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to generate a plan.",
    };
  }
}

export async function askAssistant(
  question: string
): Promise<ActionResult<AskResult>> {
  const trimmed = question.trim();
  if (!trimmed) return { ok: false, error: "Ask a question about your data." };
  try {
    return { ok: true, data: await ask(trimmed) };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to answer.",
    };
  }
}

type ApplyCounts = {
  goals: number;
  projects: number;
  habits: number;
  tasks: number;
  notes: number;
};

export async function applyPlan(
  plan: PlanGraph
): Promise<ActionResult<ApplyCounts>> {
  // Never trust the client — re-validate the plan shape.
  const parsed = planSchema.safeParse(plan);
  if (!parsed.success) return { ok: false, error: "Invalid plan." };
  const data = parsed.data;

  const userId = getCurrentUserId();
  const td = iso();

  const [existingGoals, existingProjects] = await Promise.all([
    listGoals(userId),
    listProjects(userId),
  ]);
  const existingGoalIds = new Set(existingGoals.map((g) => g.id));
  const existingProjectIds = new Set(existingProjects.map((p) => p.id));

  const goalIdByRef = new Map<string, string>();
  const projectIdByRef = new Map<string, string>();

  // Resolve a ref to a real id: a plan ref we just created, an existing id, else null.
  const resolveGoal = (ref?: string | null): string | null =>
    ref ? goalIdByRef.get(ref) ?? (existingGoalIds.has(ref) ? ref : null) : null;
  const resolveProject = (ref?: string | null): string | null =>
    ref
      ? projectIdByRef.get(ref) ?? (existingProjectIds.has(ref) ? ref : null)
      : null;

  const counts: ApplyCounts = { goals: 0, projects: 0, habits: 0, tasks: 0, notes: 0 };

  try {
    // 1. Goals (orders recomputed as we add so same-category goals don't collide).
    const goalAccum: Goal[] = [...existingGoals];
    for (const g of data.goals) {
      const created = await insertGoal({
        userId,
        title: g.title,
        category: g.category,
        metricLabel: g.metricLabel ?? "",
        progress: 0,
        targetDate: g.targetDate ?? null,
        lifeArea: g.lifeArea,
        order: nextGoalOrder(goalAccum, g.category),
        createdAt: td,
      });
      goalIdByRef.set(g.refId, created.id);
      goalAccum.push(created);
      counts.goals++;
    }

    // 2. Projects (color picked against the growing set).
    const projectAccum: Project[] = [...existingProjects];
    for (const p of data.projects) {
      const bp = p.bestPractices ?? [];
      const description = [
        p.description ?? "",
        bp.length ? `Best practices:\n${bp.map((b) => `- ${b}`).join("\n")}` : "",
      ]
        .filter(Boolean)
        .join("\n\n");
      const created = await insertProject({
        userId,
        title: p.title,
        description,
        color: pickProjectColor(projectAccum),
        progress: 0,
        label: "0/0",
        goalId: resolveGoal(p.goalRef),
        lifeArea: p.lifeArea,
        createdAt: td,
      });
      projectIdByRef.set(p.refId, created.id);
      projectAccum.push(created);
      counts.projects++;
    }

    // 3. Habits.
    for (let i = 0; i < data.habits.length; i++) {
      const h = data.habits[i];
      const goalIds = h.goalRefs
        .map((ref) => resolveGoal(ref))
        .filter((id): id is string => id !== null);
      await insertHabit({
        userId,
        name: h.name,
        color: HABIT_COLOR,
        frequency: { type: h.frequency, target: 1 },
        order: i,
        archived: false,
        goalIds,
        goalTargetStreak: h.goalTargetStreak ?? null,
        lifeArea: h.lifeArea,
        createdAt: td,
      });
      counts.habits++;
    }

    // 4. Tasks.
    for (const t of data.tasks) {
      const tagIds = await ensureTags(t.tagNames ?? []);
      const subtasks = (t.subtasks ?? []).map((title) => ({
        id: newId(),
        title,
        done: false,
      }));
      await insertTask({
        userId,
        title: t.title,
        description: t.description ?? "",
        subtasks,
        tagIds,
        priority: t.priority,
        status: "todo",
        due: t.due ?? td,
        projectId: resolveProject(t.projectRef),
        goalId: resolveGoal(t.goalRef),
        lifeArea: t.lifeArea,
        order: -Date.now(),
        createdAt: td,
        completedAt: null,
      });
      counts.tasks++;
    }

    // 5. Notes.
    for (const n of data.notes) {
      const tagIds = await ensureTags(n.tagNames ?? []);
      await insertNote({
        userId,
        title: n.title,
        body: n.body,
        tagIds,
        pinned: false,
        lifeArea: n.lifeArea,
        createdAt: td,
        updatedAt: td,
      });
      counts.notes++;
    }
  } catch {
    return { ok: false, error: "Failed to create some items. Please try again." };
  }

  revalidatePath("/", "layout");
  return { ok: true, data: counts };
}
