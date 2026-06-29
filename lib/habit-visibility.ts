import { addDays, iso, type WeekStart } from "@/lib/date";

export type HabitFrequencyType = "daily" | "weekly" | "monthly";

export type HabitVisibilitySettings = {
  dailyDays: number;
  weeklyWeeks: number;
  monthlyMonths: number;
};

export const HABIT_VISIBILITY_DEFAULTS = {
  dailyDays: { min: 1, default: 30 },
  weeklyWeeks: { min: 1, default: 8 },
  monthlyMonths: { min: 1, default: 3 },
} as const;

export const DEFAULT_HABIT_VISIBILITY: HabitVisibilitySettings = {
  dailyDays: HABIT_VISIBILITY_DEFAULTS.dailyDays.default,
  weeklyWeeks: HABIT_VISIBILITY_DEFAULTS.weeklyWeeks.default,
  monthlyMonths: HABIT_VISIBILITY_DEFAULTS.monthlyMonths.default,
};

export type HabitHeatCell = {
  id: string;
  label: string;
  done: boolean;
  isCurrent: boolean;
  toggleDate: string;
};

export function normalizeHabitFrequency(type: string): HabitFrequencyType {
  if (type === "weekly" || type === "monthly") return type;
  return "daily";
}

export function habitFrequencyLabel(type: HabitFrequencyType): string {
  switch (type) {
    case "weekly":
      return "Weekly";
    case "monthly":
      return "Monthly";
    default:
      return "Daily";
  }
}

function atLeastOne(value: number, min = 1): number {
  return Math.max(min, value);
}

function hasEntryInRange(
  entries: Set<string>,
  start: string,
  end: string
): boolean {
  for (const date of entries) {
    if (date >= start && date <= end) return true;
  }
  return false;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function weekStartDate(d: Date, weekStart: WeekStart): Date {
  const day = d.getDay();
  const offset = weekStart === "mon" ? (day + 6) % 7 : day;
  const start = new Date(d);
  start.setDate(d.getDate() - offset);
  return start;
}

export function visibleDayCount(visibility: HabitVisibilitySettings): number {
  return atLeastOne(visibility.dailyDays, HABIT_VISIBILITY_DEFAULTS.dailyDays.min);
}

export function visibleWeekCount(visibility: HabitVisibilitySettings): number {
  return atLeastOne(visibility.weeklyWeeks, HABIT_VISIBILITY_DEFAULTS.weeklyWeeks.min);
}

export function visibleMonthCount(visibility: HabitVisibilitySettings): number {
  return atLeastOne(
    visibility.monthlyMonths,
    HABIT_VISIBILITY_DEFAULTS.monthlyMonths.min
  );
}

export function habitHeatCells(
  frequency: HabitFrequencyType,
  visibility: HabitVisibilitySettings,
  entries: Set<string>,
  weekStart: WeekStart,
  today: string = iso()
): HabitHeatCell[] {
  const todayDate = new Date(today + "T00:00");

  if (frequency === "monthly") {
    const count = visibleMonthCount(visibility);
    const cells: HabitHeatCell[] = [];
    for (let i = count - 1; i >= 0; i--) {
      const month = new Date(
        todayDate.getFullYear(),
        todayDate.getMonth() - i,
        1
      );
      const start = iso(startOfMonth(month));
      const end = iso(endOfMonth(month));
      const isCurrent = i === 0;
      cells.push({
        id: `${month.getFullYear()}-${month.getMonth() + 1}`,
        label: month.toLocaleDateString("en-US", {
          month: "short",
          year: "numeric",
        }),
        done: hasEntryInRange(entries, start, end),
        isCurrent,
        toggleDate: isCurrent ? today : end,
      });
    }
    return cells;
  }

  if (frequency === "weekly") {
    const count = visibleWeekCount(visibility);
    const currentWeekStart = weekStartDate(todayDate, weekStart);
    const cells: HabitHeatCell[] = [];
    for (let i = count - 1; i >= 0; i--) {
      const start = new Date(currentWeekStart);
      start.setDate(start.getDate() - i * 7);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      const startIso = iso(start);
      const endIso = iso(end);
      const isCurrent = i === 0;
      cells.push({
        id: startIso,
        label: `${startIso.slice(5)} – ${endIso.slice(5)}`,
        done: hasEntryInRange(entries, startIso, endIso),
        isCurrent,
        toggleDate: isCurrent ? today : endIso,
      });
    }
    return cells;
  }

  const dayCount = visibleDayCount(visibility);
  const cells: HabitHeatCell[] = [];
  for (let k = dayCount - 1; k >= 0; k--) {
    const date = iso(addDays(-k, todayDate));
    cells.push({
      id: date,
      label: date,
      done: entries.has(date),
      isCurrent: k === 0,
      toggleDate: date,
    });
  }
  return cells;
}

export function habitVisibilityFromSettings(
  settings: {
    habitVisibleDays?: number;
    habitVisibleWeeks?: number;
    habitVisibleMonths?: number;
    /** @deprecated legacy month-based fields */
    habitVisibleMonthsDaily?: number;
    habitVisibleMonthsWeekly?: number;
    habitVisibleMonthsMonthly?: number;
  } | null
): HabitVisibilitySettings {
  const dailyDays =
    settings?.habitVisibleDays ??
    (settings?.habitVisibleMonthsDaily != null
      ? settings.habitVisibleMonthsDaily * 30
      : DEFAULT_HABIT_VISIBILITY.dailyDays);

  const weeklyWeeks =
    settings?.habitVisibleWeeks ??
    (settings?.habitVisibleMonthsWeekly != null
      ? settings.habitVisibleMonthsWeekly * 4
      : DEFAULT_HABIT_VISIBILITY.weeklyWeeks);

  const monthlyMonths =
    settings?.habitVisibleMonths ??
    settings?.habitVisibleMonthsMonthly ??
    DEFAULT_HABIT_VISIBILITY.monthlyMonths;

  return {
    dailyDays: atLeastOne(dailyDays, HABIT_VISIBILITY_DEFAULTS.dailyDays.min),
    weeklyWeeks: atLeastOne(
      weeklyWeeks,
      HABIT_VISIBILITY_DEFAULTS.weeklyWeeks.min
    ),
    monthlyMonths: atLeastOne(
      monthlyMonths,
      HABIT_VISIBILITY_DEFAULTS.monthlyMonths.min
    ),
  };
}
