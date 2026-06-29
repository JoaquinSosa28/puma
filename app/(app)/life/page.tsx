import { loadPageData } from "@/lib/page-data";
import { listLifeDays } from "@/lib/db/life-days";
import { listLifeWeeks } from "@/lib/db/life-weeks";
import { normalizeLifeWeekKeys } from "@/lib/db/normalize-life-weeks";
import { LifeCalendarView } from "@/components/life/LifeCalendarView";
import { LIFE_SPAN_MAX } from "@/lib/date";

type Props = { searchParams: Promise<{ life?: string }> };

export default async function LifePage({ searchParams }: Props) {
  const data = await loadPageData(searchParams);
  const settings = data.settings;

  if (settings?.birthDate) {
    await normalizeLifeWeekKeys();
  }

  const [lifeDays, lifeWeeks] = await Promise.all([
    listLifeDays(),
    listLifeWeeks(),
  ]);

  return (
    <LifeCalendarView
      birthDate={settings?.birthDate ?? null}
      lifeSpanYears={settings?.lifeSpanYears ?? LIFE_SPAN_MAX}
      lifeCalendarFullView={settings?.lifeCalendarFullView ?? false}
      lifeDays={lifeDays}
      lifeWeeks={lifeWeeks}
      tasks={data.allTasks}
      stats={data.stats}
    />
  );
}
