import { loadPageData } from "@/lib/page-data";
import { getSettings } from "@/lib/db/settings";
import { habitVisibilityFromSettings } from "@/lib/habit-visibility";
import { HabitsView } from "@/components/habits/HabitsView";

type Props = { searchParams: Promise<{ tag?: string; life?: string }> };

export default async function HabitsPage({ searchParams }: Props) {
  const [data, settings] = await Promise.all([
    loadPageData(searchParams),
    getSettings(),
  ]);
  return (
    <HabitsView
      habits={data.habits}
      habitEntries={data.habitEntries}
      goals={data.goals}
      stats={data.stats}
      habitVisibility={habitVisibilityFromSettings(settings)}
      weekStart={settings?.weekStart ?? "mon"}
      birthDate={data.birthDate}
      lifeSpanYears={data.lifeSpanYears}
    />
  );
}
