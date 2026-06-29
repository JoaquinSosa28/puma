import { loadPageData } from "@/lib/page-data";
import { habitVisibilityFromSettings } from "@/lib/habit-visibility";
import { HabitsView } from "@/components/habits/HabitsView";

type Props = { searchParams: Promise<{ tag?: string; life?: string }> };

export default async function HabitsPage({ searchParams }: Props) {
  const data = await loadPageData(searchParams);
  return (
    <HabitsView
      habits={data.habits}
      habitEntries={data.habitEntries}
      goals={data.goals}
      stats={data.stats}
      habitVisibility={habitVisibilityFromSettings(data.settings)}
      weekStart={data.settings?.weekStart ?? "mon"}
      birthDate={data.birthDate}
      lifeSpanYears={data.lifeSpanYears}
    />
  );
}
