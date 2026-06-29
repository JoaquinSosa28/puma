import { randomBytes } from "crypto";

export function oid(): string {
  return randomBytes(12).toString("hex");
}

export function iso(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function addDays(n: number, from: Date = new Date()): Date {
  const d = new Date(from);
  d.setDate(d.getDate() + n);
  return d;
}

export function formatDay(isoDate: string): string {
  return new Date(isoDate + "T00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/** DD/MM from ISO date (e.g. 2026-11-02 → 02/11) */
export function formatDayShort(isoDate: string): string {
  const [y, m, d] = isoDate.slice(0, 10).split("-");
  if (!y || !m || !d) return isoDate;
  return `${d}/${m}`;
}

/** DD/MM/YYYY from ISO date */
export function formatDayFull(isoDate: string): string {
  const [y, m, d] = isoDate.slice(0, 10).split("-");
  if (!y || !m || !d) return isoDate;
  return `${d}/${m}/${y}`;
}

/** Default note title when none is given, e.g. "New note 21/06 - 14:35" */
export function defaultNoteTitle(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `New note ${p(d.getDate())}/${p(d.getMonth() + 1)} - ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export type WeekStart = "mon" | "sun";

export const DOW_LETTERS_MON = ["M", "T", "W", "T", "F", "S", "S"] as const;
export const DOW_LETTERS_SUN = ["S", "M", "T", "W", "T", "F", "S"] as const;

export function dowLetters(weekStart: WeekStart = "mon"): readonly string[] {
  return weekStart === "sun" ? DOW_LETTERS_SUN : DOW_LETTERS_MON;
}

export function weekDates(
  from: Date = new Date(),
  weekStart: WeekStart = "mon"
): Date[] {
  const t = new Date(from);
  const offset = weekStart === "sun" ? t.getDay() : (t.getDay() + 6) % 7;
  const start = new Date(t);
  start.setDate(t.getDate() - offset);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

export function streakOf(dates: Set<string>, today: string = iso()): number {
  let c = 0;
  const cur = new Date(today + "T00:00");
  if (!dates.has(today)) {
    cur.setDate(cur.getDate() - 1);
  }
  while (dates.has(iso(cur))) {
    c++;
    cur.setDate(cur.getDate() - 1);
  }
  return c;
}

export function bestStreak(dates: Set<string>): number {
  const arr = [...dates].sort();
  let best = 0;
  let cur = 0;
  let prev: string | null = null;
  for (const ds of arr) {
    if (prev) {
      const diff = Math.round(
        (new Date(ds).getTime() - new Date(prev).getTime()) / 86400000
      );
      cur = diff === 1 ? cur + 1 : 1;
    } else {
      cur = 1;
    }
    best = Math.max(best, cur);
    prev = ds;
  }
  return best;
}

export function dateLabel(d: Date = new Date()): string {
  return d
    .toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    })
    .toUpperCase();
}

export function weekNumber(d: Date = new Date()): number {
  const start = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - start.getTime()) / 86400000 + 1) / 7);
}

import { DEFAULT_USER_NAME } from "@/lib/user-display";

export function greeting(name = DEFAULT_USER_NAME): string {
  const h = new Date().getHours();
  const part =
    h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  return `${part}, ${name}`;
}

export function dueDatePart(due: string | null): string {
  if (!due) return "";
  if (due.includes("T")) return due.split("T")[1] ?? "";
  return new Date(due + "T00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function taskDueDateInput(due: string | null): string {
  return due?.slice(0, 10) ?? "";
}

/** Preserve meeting time when only the calendar date changes. */
export function mergeTaskDueDate(
  datePart: string,
  existingDue: string | null
): string | null {
  if (!datePart) return null;
  const time = existingDue?.includes("T") ? existingDue.split("T")[1] : null;
  return time ? `${datePart}T${time}` : datePart;
}

export function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export { LIFE_SPAN_MAX } from "./life-constants";

export function addYears(years: number, fromIso: string): string {
  const d = new Date(fromIso + "T00:00");
  d.setFullYear(d.getFullYear() + years);
  return iso(d);
}

export function daysBetween(startIso: string, endIso: string): number {
  const start = new Date(startIso + "T00:00").getTime();
  const end = new Date(endIso + "T00:00").getTime();
  return Math.round((end - start) / 86400000);
}

/** Whole years elapsed since birth on a given date (birthday-aware). */
export function ageAt(birthDate: string, onDate: string = iso()): number {
  const birth = new Date(birthDate + "T00:00");
  const on = new Date(onDate + "T00:00");
  let years = on.getFullYear() - birth.getFullYear();
  const beforeBirthday =
    on.getMonth() < birth.getMonth() ||
    (on.getMonth() === birth.getMonth() && on.getDate() < birth.getDate());
  if (beforeBirthday) years -= 1;
  return Math.max(0, years);
}

export function formatTimeHM(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Index of the agenda event happening now, or -1 before first / length after last. */
export function currentAgendaIndex(
  times: string[],
  nowMins: number = parseTimeToMinutes(formatTimeHM())
): number {
  if (!times.length) return -1;
  const sorted = [...times].sort((a, b) => parseTimeToMinutes(a) - parseTimeToMinutes(b));
  if (nowMins < parseTimeToMinutes(sorted[0])) return -1;
  for (let i = 0; i < sorted.length; i++) {
    const start = parseTimeToMinutes(sorted[i]);
    const next = sorted[i + 1];
    if (!next || nowMins < parseTimeToMinutes(next)) {
      if (nowMins >= start) return i;
    }
  }
  return sorted.length;
}
