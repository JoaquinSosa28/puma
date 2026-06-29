import {
  buildLifeWeeks,
  clampLifeSpanYears,
} from "@/lib/life-calendar";
import { LIFE_SPAN_MAX } from "@/lib/life-constants";
import { dateLabel, iso } from "@/lib/date";

export type TopbarDateContext = {
  birthDate?: string | null;
  lifeSpanYears?: number;
};

/** ISO week number (1–53). */
export function isoWeekNumber(d: Date = new Date()): number {
  const date = new Date(d.getTime());
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  const week1 = new Date(date.getFullYear(), 0, 4);
  return (
    1 +
    Math.round(
      ((date.getTime() - week1.getTime()) / 86400000 -
        3 +
        ((week1.getDay() + 6) % 7)) /
        7
    )
  );
}

export function isoWeeksInYear(year: number): number {
  return isoWeekNumber(new Date(year, 11, 28));
}

export function daysInMonth(d: Date = new Date()): number {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

/** Mon=1 … Fri=5; weekends return null. */
export function workweekDay(
  d: Date = new Date()
): { day: number; label: string } | null {
  const dow = d.getDay();
  if (dow === 0 || dow === 6) return null;
  const labels = ["", "MON", "TUE", "WED", "THU", "FRI"] as const;
  return { day: dow, label: labels[dow]! };
}

export function lifeWeekProgress(
  birthDate: string,
  spanYears: number = LIFE_SPAN_MAX,
  today: string = iso()
): { lived: number; total: number } {
  const span = clampLifeSpanYears(spanYears);
  const weeks = buildLifeWeeks(birthDate, span);
  const total = weeks.length;
  const todayStr = today.slice(0, 10);
  if (todayStr < birthDate.slice(0, 10)) return { lived: 0, total };

  const slot = weeks.find((w) => w.days.includes(todayStr));
  const lived =
    slot?.weekIndex ??
    weeks.filter((w) => w.weekEnd < todayStr).length;
  return { lived, total };
}

function formatCount(n: number): string {
  return n.toLocaleString("en-US");
}

/** Rich date line for the top bar, e.g. SUNDAY, JUNE 28 · DAY 28/30 · … */
export function formatTopbarDateLine(
  d: Date = new Date(),
  ctx: TopbarDateContext = {}
): string {
  const parts: string[] = [dateLabel(d)];

  const day = d.getDate();
  const monthDays = daysInMonth(d);
  const month = d
    .toLocaleDateString("en-US", { month: "short" })
    .toUpperCase();
  parts.push(`DAY ${day}/${monthDays} ${month}`);

  const week = isoWeekNumber(d);
  const weeksInYear = isoWeeksInYear(d.getFullYear());
  parts.push(`WEEK ${week}/${weeksInYear}`);

  if (ctx.birthDate) {
    const { lived, total } = lifeWeekProgress(
      ctx.birthDate,
      ctx.lifeSpanYears ?? LIFE_SPAN_MAX,
      iso(d)
    );
    parts.push(`LIFE WEEK ${formatCount(lived)}/${formatCount(total)}`);
  }

  const work = workweekDay(d);
  if (work) {
    parts.push(`${work.label} ${work.day}/5`);
  } else {
    parts.push("WEEKEND");
  }

  return parts.join(" · ");
}
