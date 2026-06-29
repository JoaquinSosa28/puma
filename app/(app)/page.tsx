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
      <div className="grid min-h-0 flex-1 grid-cols-[304px_1fr_340px] gap-4 overflow-hidden pb-5 animate-puma-view">
        <AgendaPanel
          agenda={data.agenda}
          carryover={data.carryover}
          tasks={data.allTasks}
          lifeView={lifeView}
          weekStart={weekStart}
        />
        <HomeTasksProjects
          todayTasks={data.todayTasks}
          projects={data.projects}
          allTasks={data.allTasks}
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
