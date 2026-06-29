// Server-only goal sync: reads/writes the database to recompute goal progress
// from linked projects + habits. Kept separate from lib/goal-sync.ts (pure) so
// Client Components can import the pure helpers without pulling in the data layer.
import "server-only";
import { listGoals, updateGoal } from "@/lib/db/goals";
import { listProjects } from "@/lib/db/projects";
import { listHabits } from "@/lib/db/habits";
import { listHabitEntries } from "@/lib/db/habitEntries";
import { listTasks } from "@/lib/db/tasks";
import { computeGoalProgress } from "@/lib/goal-sync";

export async function syncGoalProgress(goalId: string): Promise<void> {
  const [projects, habits, habitEntries, tasks] = await Promise.all([
    listProjects(),
    listHabits(),
    listHabitEntries(),
    listTasks(),
  ]);
  const progress = computeGoalProgress(
    goalId,
    projects,
    habits,
    habitEntries,
    tasks
  );
  if (progress === null) return;
  await updateGoal(goalId, { progress });
}

export async function syncGoalsForProject(projectId: string): Promise<void> {
  const projects = await listProjects();
  const project = projects.find((p) => p.id === projectId);
  if (project?.goalId) await syncGoalProgress(project.goalId);
}

export async function syncGoalsForHabit(habitId: string): Promise<void> {
  const habits = await listHabits();
  const habit = habits.find((h) => h.id === habitId);
  if (habit?.goalIds.length) {
    for (const goalId of habit.goalIds) await syncGoalProgress(goalId);
  }
}

export async function syncAllLinkedGoals(): Promise<void> {
  const goals = await listGoals();
  for (const goal of goals) {
    await syncGoalProgress(goal.id);
  }
}
