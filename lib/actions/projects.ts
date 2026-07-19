"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/types";
import type { Project } from "@/lib/schemas";
import {
  getProject,
  insertProject,
  listProjects,
  updateProject,
  deleteProject,
} from "@/lib/db/projects";
import { syncGoalProgress, syncGoalsForProject } from "@/lib/goal-sync-server";
import { requireUserId } from "@/lib/auth/session";
import { userToday } from "@/lib/timezone-server";
import { pickProjectColor } from "@/lib/project-colors";

const createProjectSchema = z.object({
  title: z.string().trim().min(1).max(120),
  lifeArea: z.enum(["personal", "work"]).optional(),
  color: z.string().optional(),
});

export async function createProjectAction(
  input: z.infer<typeof createProjectSchema>
): Promise<ActionResult<Project>> {
  const parsed = createProjectSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  const userId = await requireUserId();
  const { today: createdAt } = await userToday();
  const existing = await listProjects(userId);
  const project = await insertProject({
    userId,
    title: parsed.data.title,
    description: "",
    color: parsed.data.color ?? pickProjectColor(existing),
    progress: 0,
    label: "0/0",
    goalId: null,
    lifeArea: parsed.data.lifeArea ?? "personal",
    createdAt,
  });

  revalidatePath("/", "layout");
  return { ok: true, data: project };
}

const updateProjectDetailSchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  description: z.string().optional(),
  lifeArea: z.enum(["personal", "work"]).optional(),
  color: z.string().optional(),
});

export async function updateProjectDetail(
  input: z.infer<typeof updateProjectDetailSchema>
): Promise<ActionResult<Project>> {
  const parsed = updateProjectDetailSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  const { id, ...patch } = parsed.data;
  if (!Object.keys(patch).length) return { ok: false, error: "Nothing to update" };

  const userId = await requireUserId();
  const existing = await getProject(userId, id);
  if (!existing) return { ok: false, error: "Not found" };

  const updated = await updateProject(userId, id, patch);
  if (!updated) return { ok: false, error: "Not found" };

  if (existing.goalId) await syncGoalsForProject(userId, id);
  revalidatePath("/", "layout");
  return { ok: true, data: updated };
}

export async function deleteProjectAction(id: string): Promise<ActionResult> {
  const userId = await requireUserId();
  const existing = await getProject(userId, id);
  if (!existing) return { ok: false, error: "Not found" };

  const goalId = existing.goalId;
  const deleted = await deleteProject(userId, id);
  if (!deleted) return { ok: false, error: "Not found" };

  if (goalId) await syncGoalProgress(userId, goalId);
  revalidatePath("/", "layout");
  return { ok: true };
}
