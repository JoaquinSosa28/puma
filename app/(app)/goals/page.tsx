import { loadPageData } from "@/lib/page-data";
import { listHabitEntries } from "@/lib/db/habitEntries";
import { listHabits } from "@/lib/db/habits";
import { listProjects } from "@/lib/db/projects";
import { listTasks } from "@/lib/db/tasks";
import { getSettings } from "@/lib/db/settings";
import { habitVisibilityFromSettings } from "@/lib/habit-visibility";
import { GoalsView } from "@/components/goals/GoalsView";

type Props = { searchParams: Promise<{ tag?: string; life?: string }> };

export default async function GoalsPage({ searchParams }: Props) {
  const [data, projects, habits, habitEntries, tasks, settings] = await Promise.all([
    loadPageData(searchParams),
    listProjects(),
    listHabits(),
    listHabitEntries(),
    listTasks(),
    getSettings(),
  ]);

  return (
    <GoalsView
      goals={data.goals}
      projects={projects}
      habits={habits}
      habitEntries={habitEntries}
      tasks={tasks}
      stats={data.stats}
      habitVisibility={habitVisibilityFromSettings(settings)}
      weekStart={settings?.weekStart ?? "mon"}
      birthDate={data.birthDate}
      lifeSpanYears={data.lifeSpanYears}
    />
  );
}
