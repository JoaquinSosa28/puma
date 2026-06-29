import { loadPageData } from "@/lib/page-data";
import { habitVisibilityFromSettings } from "@/lib/habit-visibility";
import { GoalsView } from "@/components/goals/GoalsView";

type Props = { searchParams: Promise<{ tag?: string; life?: string }> };

export default async function GoalsPage({ searchParams }: Props) {
  const data = await loadPageData(searchParams);

  return (
    <GoalsView
      goals={data.goals}
      projects={data.projects}
      habits={data.habits}
      habitEntries={data.habitEntries}
      tasks={data.allTasks}
      stats={data.stats}
      habitVisibility={habitVisibilityFromSettings(data.settings)}
      weekStart={data.settings?.weekStart ?? "mon"}
      birthDate={data.birthDate}
      lifeSpanYears={data.lifeSpanYears}
    />
  );
}
