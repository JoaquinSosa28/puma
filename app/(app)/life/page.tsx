import { loadPageData } from "@/lib/page-data";
import { getSettings } from "@/lib/db/settings";
import { listLifeDays } from "@/lib/db/life-days";
import { listLifeWeeks } from "@/lib/db/life-weeks";
import { normalizeLifeWeekKeys } from "@/lib/db/normalize-life-weeks";
import { listTasks } from "@/lib/db/tasks";
import { LifeCalendarView } from "@/components/life/LifeCalendarView";
import { LIFE_SPAN_MAX } from "@/lib/date";

type Props = { searchParams: Promise<{ life?: string }> };

export default async function LifePage({ searchParams }: Props) {
  const [data, settings] = await Promise.all([
    loadPageData(searchParams),
    getSettings(),
  ]);

  if (settings?.birthDate) {
    await normalizeLifeWeekKeys();
  }

  const [lifeDays, lifeWeeks, allTasks] = await Promise.all([
    listLifeDays(),
    listLifeWeeks(),
    listTasks(),
  ]);

  return (
    <LifeCalendarView
      birthDate={settings?.birthDate ?? null}
      lifeSpanYears={settings?.lifeSpanYears ?? LIFE_SPAN_MAX}
      lifeCalendarFullView={settings?.lifeCalendarFullView ?? false}
      lifeDays={lifeDays}
      lifeWeeks={lifeWeeks}
      tasks={allTasks}
      stats={data.stats}
    />
  );
}
