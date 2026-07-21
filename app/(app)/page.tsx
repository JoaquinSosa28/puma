import { loadPageData } from "@/lib/page-data";
import { Topbar } from "@/components/shell/Topbar";
import { AgendaPanel } from "@/components/home/AgendaPanel";
import { HomeTasksProjects } from "@/components/home/HomeTasksProjects";
import { HomeHabitsGoals } from "@/components/home/HomeHabitsGoals";
import { displayName } from "@/lib/user-display";
import { hrefWithLife } from "@/lib/life-area";

type Props = {
  searchParams: Promise<{ life?: string; day?: string }>;
};

export default async function HomePage({ searchParams }: Props) {
  const data = await loadPageData(searchParams);
  const today = data.today;
  const { lifeView } = data;
  const weekStart = data.settings?.weekStart ?? "mon";

  return (
    <>
      <Topbar
        title=""
        showGreeting
        userName={displayName(data.user)}
        dayPct={data.stats.dayPct}
        habitsLabel={data.stats.habitsLabel}
        topStreak={data.stats.topStreak}
        birthDate={data.birthDate}
        lifeSpanYears={data.lifeSpanYears}
        statLinks={{
          calendar: hrefWithLife(`/calendar?day=${today}`, lifeView),
          dayDone: hrefWithLife("/tasks?tab=today", lifeView),
          habits: hrefWithLife("/habits", lifeView),
          streak: hrefWithLife("/habits", lifeView),
        }}
      />
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pb-5 animate-puma-view md:grid md:grid-cols-2 md:[&>*:nth-child(3)]:col-span-2 lg:grid-cols-[304px_1fr_340px] lg:overflow-hidden lg:[&>*:nth-child(3)]:col-span-1">
        <AgendaPanel
          agenda={data.agenda}
          tasks={data.allTasks}
          lifeView={lifeView}
          weekStart={weekStart}
        />
        <HomeTasksProjects
          projects={data.projects}
          allTasks={data.allTasks}
          carryover={data.carryover}
          tags={data.tags}
          lifeView={lifeView}
          today={data.today}
        />
        <HomeHabitsGoals
          habits={data.habits}
          habitEntries={data.habitEntries}
          goals={data.goals}
          topStreak={data.stats.topStreak}
          lifeView={lifeView}
          weekStart={weekStart}
        />
      </div>
    </>
  );
}
