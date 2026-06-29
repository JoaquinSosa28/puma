import { listTasks } from "@/lib/db/tasks";
import { listHabits } from "@/lib/db/habits";
import { listHabitEntries } from "@/lib/db/habitEntries";
import { listGoals } from "@/lib/db/goals";
import { listProjects } from "@/lib/db/projects";
import { listTags } from "@/lib/db/tags";
import { listAgenda } from "@/lib/db/agenda";
import { listNotes } from "@/lib/db/notes";
import { getCurrentUser } from "@/lib/db/users";
import { getSettings } from "@/lib/db/settings";
import { LIFE_SPAN_MAX } from "@/lib/life-constants";
import {
  dayDonePercent,
  openTaskCount,
  habitsDoneToday,
  topStreak,
} from "@/lib/metrics";
import { streakOf, iso } from "@/lib/date";
import { computeGoalProgress } from "@/lib/goal-sync";
import {
  DEFAULT_LIFE_VIEW,
  filterByLifeView,
  type LifeView,
} from "@/lib/life-area";

export type LoadAppDataOptions = {
  lifeView?: LifeView;
};

export async function loadAppData(options: LoadAppDataOptions = {}) {
  const lifeView = options.lifeView ?? DEFAULT_LIFE_VIEW;

  const [
    allTasks,
    allHabits,
    allHabitEntries,
    allProjects,
    allGoals,
    tags,
    allAgenda,
    allNotes,
    user,
    settings,
  ] = await Promise.all([
    listTasks(),
    listHabits(),
    listHabitEntries(),
    listProjects(),
    listGoals(),
    listTags(),
    listAgenda(),
    listNotes(),
    getCurrentUser(),
    getSettings(),
  ]);

  // Goal progress is derived from linked projects + habits, computed on read
  // (cheap, in-memory) instead of being resynced to the DB on every load. Goals
  // with no links keep their stored/manual progress.
  const allGoals2 = allGoals.map((g) => ({
    ...g,
    progress:
      computeGoalProgress(
        g.id,
        allProjects,
        allHabits,
        allHabitEntries,
        allTasks
      ) ?? g.progress,
  }));

  const tasks = filterByLifeView(allTasks, lifeView);
  const habits = filterByLifeView(allHabits, lifeView);
  const habitIds = new Set(habits.map((h) => h.id));
  const habitEntries = allHabitEntries.filter((e) => habitIds.has(e.habitId));
  const goals = allGoals2;
  const projects = filterByLifeView(allProjects, lifeView);
  const agenda = filterByLifeView(allAgenda, lifeView);
  const notes = filterByLifeView(allNotes, lifeView);

  const td = iso();
  const carryover = filterByLifeView(
    allTasks.filter(
      (t) =>
        t.status !== "done" &&
        (t.due ?? "") !== "" &&
        (t.due ?? "").slice(0, 10) < td
    ),
    lifeView
  );

  return {
    tasks,
    allTasks: tasks,
    habits,
    habitEntries,
    goals,
    projects,
    tags,
    agenda,
    notes,
    user,
    lifeView,
    todayTasks: tasks.filter((t) => (t.due ?? "").slice(0, 10) === td),
    carryover,
    counts: {
      openTasks: openTaskCount(tasks),
      notes: notes.length,
      habits: habits.length,
      goals: goals.length,
      projects: projects.length,
    },
    stats: {
      dayPct: dayDonePercent(tasks, habits, habitEntries, td),
      habitsLabel: habitsDoneToday(habits, habitEntries, td).label,
      topStreak: topStreak(habits, habitEntries, (set) => streakOf(set, td)),
    },
    birthDate: settings?.birthDate ?? null,
    lifeSpanYears: settings?.lifeSpanYears ?? LIFE_SPAN_MAX,
  };
}
