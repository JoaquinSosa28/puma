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
import { resolveTimezoneFromSettings } from "@/lib/timezone-server";
import { computeGoalProgress } from "@/lib/goal-sync";
import {
  DEFAULT_LIFE_VIEW,
  filterByLifeView,
  type LifeView,
} from "@/lib/life-area";
import { cache } from "react";
import type { Settings } from "@/lib/schemas";

export type LoadAppDataOptions = {
  lifeView?: LifeView;
};

type CoreCollections = {
  allTasks: Awaited<ReturnType<typeof listTasks>>;
  allHabits: Awaited<ReturnType<typeof listHabits>>;
  allHabitEntries: Awaited<ReturnType<typeof listHabitEntries>>;
  allGoals: Awaited<ReturnType<typeof listGoals>>;
  allProjects: Awaited<ReturnType<typeof listProjects>>;
  tags: Awaited<ReturnType<typeof listTags>>;
  allNotes: Awaited<ReturnType<typeof listNotes>>;
  allAgenda: Awaited<ReturnType<typeof listAgenda>>;
  user: Awaited<ReturnType<typeof getCurrentUser>>;
  settings: Awaited<ReturnType<typeof getSettings>>;
};

/**
 * Shared DB reads — deduped (React cache) across the layout shell + the page in
 * one request, and issued as a SINGLE parallel batch. Everything a page needs
 * (incl. habit entries + agenda) is fetched here so the page itself does no extra
 * round-trip after the layout — important over high-latency links / VPNs.
 */
const fetchCoreCollections = cache(async (): Promise<CoreCollections> => {
  if (process.env.DATA_SOURCE === "mongodb") {
    const { warmMongoConnection } = await import("@/lib/mongodb");
    await warmMongoConnection();
  }

  const [
    allTasks,
    allHabits,
    allHabitEntries,
    allGoals,
    allProjects,
    tags,
    allNotes,
    allAgenda,
    user,
    settings,
  ] = await Promise.all([
    listTasks(),
    listHabits(),
    listHabitEntries(),
    listGoals(),
    listProjects(),
    listTags(),
    listNotes(),
    listAgenda(),
    getCurrentUser(),
    getSettings(),
  ]);
  return {
    allTasks,
    allHabits,
    allHabitEntries,
    allGoals,
    allProjects,
    tags,
    allNotes,
    allAgenda,
    user,
    settings,
  };
});

function shellFromCore(
  core: CoreCollections,
  lifeView: LifeView,
  timezone: string
) {
  const tasks = filterByLifeView(core.allTasks, lifeView);
  const habits = filterByLifeView(core.allHabits, lifeView);
  const projects = filterByLifeView(core.allProjects, lifeView);
  const notes = filterByLifeView(core.allNotes, lifeView);

  return {
    tasks,
    allTasks: tasks,
    habits,
    goals: core.allGoals,
    projects,
    tags: core.tags,
    notes,
    user: core.user,
    settings: core.settings,
    lifeView,
    timezone,
    counts: {
      openTasks: openTaskCount(tasks),
      notes: notes.length,
      habits: habits.length,
      goals: core.allGoals.length,
      projects: projects.length,
    },
    birthDate: core.settings?.birthDate ?? null,
    lifeSpanYears: core.settings?.lifeSpanYears ?? LIFE_SPAN_MAX,
  };
}

/** Lightweight data for the app shell (sidebar, omnibar). Skips habit entries, agenda, stats. */
const loadShellDataForView = cache(async (lifeView: LifeView) => {
  const core = await fetchCoreCollections();
  const timezone = await resolveTimezoneFromSettings(core.settings);
  return shellFromCore(core, lifeView, timezone);
});

const loadAppDataForView = cache(async (lifeView: LifeView) => {
  const core = await fetchCoreCollections();
  const allHabitEntries = core.allHabitEntries;
  const allAgenda = core.allAgenda;
  const timezone = await resolveTimezoneFromSettings(core.settings);

  const shell = shellFromCore(core, lifeView, timezone);
  const { tasks, habits, goals, projects, notes, user, settings } = shell;

  const allGoals2 = core.allGoals.map((g) => ({
    ...g,
    progress:
      computeGoalProgress(
        g.id,
        core.allProjects,
        core.allHabits,
        allHabitEntries,
        core.allTasks
      ) ?? g.progress,
  }));

  const habitIds = new Set(habits.map((h) => h.id));
  const habitEntries = allHabitEntries.filter((e) => habitIds.has(e.habitId));
  const agenda = filterByLifeView(allAgenda, lifeView);

  const td = iso(new Date(), timezone);
  const carryover = filterByLifeView(
    core.allTasks.filter(
      (t) =>
        t.status !== "done" &&
        (t.due ?? "") !== "" &&
        (t.due ?? "").slice(0, 10) < td
    ),
    lifeView
  );

  return {
    ...shell,
    goals: allGoals2,
    habitEntries,
    agenda,
    today: td,
    todayTasks: tasks.filter((t) => (t.due ?? "").slice(0, 10) === td),
    carryover,
    stats: {
      dayPct: dayDonePercent(tasks, habits, habitEntries, td),
      habitsLabel: habitsDoneToday(habits, habitEntries, td).label,
      topStreak: topStreak(habits, habitEntries, (set) => streakOf(set, td)),
    },
  };
});

export async function loadShellData(options: LoadAppDataOptions = {}) {
  return loadShellDataForView(options.lifeView ?? DEFAULT_LIFE_VIEW);
}

export async function loadAppData(options: LoadAppDataOptions = {}) {
  return loadAppDataForView(options.lifeView ?? DEFAULT_LIFE_VIEW);
}

export type ShellData = Awaited<ReturnType<typeof loadShellData>>;
export type AppData = Awaited<ReturnType<typeof loadAppData>>;
export type AppSettings = Settings | null;
