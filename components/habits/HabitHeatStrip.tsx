"use client";

import type { Habit } from "@/lib/schemas";
import { iso, type WeekStart } from "@/lib/date";
import { useTimezone } from "@/components/shell/TimeZoneProvider";
import {
  habitHeatCells,
  normalizeHabitFrequency,
  type HabitHeatCell,
  type HabitVisibilitySettings,
} from "@/lib/habit-visibility";
import { cn } from "@/lib/utils";

type Props = {
  habit: Habit;
  entries: Set<string>;
  visibility: HabitVisibilitySettings;
  weekStart?: WeekStart;
  today?: string;
  onToggleDate?: (date: string) => void;
  compact?: boolean;
  className?: string;
};

const DONE_BG = "oklch(0.6 0.13 155)";

/** Mon-first or Sun-first weekday initials for the row gutter. */
function weekdayInitials(weekStart: WeekStart): string[] {
  const mon = ["M", "T", "W", "T", "F", "S", "S"];
  const sun = ["S", "M", "T", "W", "T", "F", "S"];
  return weekStart === "mon" ? mon : sun;
}

function monthShort(isoDate: string): string {
  return new Date(isoDate + "T00:00").toLocaleDateString("en-US", {
    month: "short",
  });
}

/**
 * History for one habit, drawn so you can always tell WHICH box you're about
 * to click — the old version was an unlabelled run of identical squares.
 *
 *  • daily   → a week-per-column grid (weekday gutter + month headers), the
 *              same reading model as a contribution graph.
 *  • weekly  → one box per week, showing the week's starting day number.
 *  • monthly → one box per month, showing the month's name.
 */
export function HabitHeatStrip({
  habit,
  entries,
  visibility,
  weekStart = "mon",
  today,
  onToggleDate,
  compact = false,
  className,
}: Props) {
  const timeZone = useTimezone();
  const td = today ?? iso(new Date(), timeZone);
  const frequency = normalizeHabitFrequency(habit.frequency.type);
  const cells = habitHeatCells(frequency, visibility, entries, weekStart, td, timeZone);

  const cellStyle = (cell: HabitHeatCell) => ({
    background: cell.done ? DONE_BG : "var(--border2)",
    border: cell.done ? "none" : "1px solid var(--border)",
    outline: cell.isCurrent ? "2px solid var(--faint2)" : undefined,
    outlineOffset: cell.isCurrent ? "1px" : undefined,
  });

  const interactive =
    onToggleDate &&
    "cursor-pointer hover:outline hover:outline-2 hover:outline-faint2 hover:outline-offset-1";

  // ---- weekly / monthly: wide boxes that carry their own label ----
  if (frequency !== "daily") {
    const size =
      frequency === "monthly"
        ? compact
          ? "h-5 min-w-[38px] px-1"
          : "h-6 min-w-[44px] px-1.5"
        : compact
          ? "h-5 min-w-[26px] px-1"
          : "h-6 min-w-[30px] px-1";

    return (
      <div
        className={cn(
          "flex flex-wrap items-center",
          frequency === "weekly" ? "gap-1.5" : "gap-2",
          className
        )}
      >
        {cells.map((cell, index) => {
          const label =
            frequency === "monthly"
              ? cell.label.split(" ")[0]
              : // weekly: the week's starting day-of-month
                String(Number(cell.id.slice(8, 10)));
          const content = (
            <span
              className={cn(
                "font-mono tabular-nums",
                compact ? "text-[8.5px]" : "text-[9.5px]",
                cell.done ? "font-bold text-white" : "text-faint"
              )}
            >
              {label}
            </span>
          );
          const cls = cn(
            size,
            "flex shrink-0 items-center justify-center rounded-[4px] transition-[outline] ",
            frequency === "weekly" && index > 0 && index % 4 === 0 && "ml-3",
            interactive
          );

          return onToggleDate ? (
            <button
              key={cell.id}
              type="button"
              title={cell.label}
              onClick={() => onToggleDate(cell.toggleDate)}
              className={cls}
              style={cellStyle(cell)}
            >
              {content}
            </button>
          ) : (
            <span
              key={cell.id}
              title={cell.label}
              className={cls}
              style={cellStyle(cell)}
            >
              {content}
            </span>
          );
        })}
      </div>
    );
  }

  // ---- daily: columns are weeks, rows are weekdays ----
  const initials = weekdayInitials(weekStart);
  // Pad the front so the first column starts on the week's first day.
  const firstDow = (() => {
    const d = new Date(cells[0]!.id + "T00:00").getDay();
    return weekStart === "mon" ? (d + 6) % 7 : d;
  })();
  const slots: (HabitHeatCell | null)[] = [
    ...Array.from({ length: firstDow }, () => null),
    ...cells,
  ];
  const columns: (HabitHeatCell | null)[][] = [];
  for (let i = 0; i < slots.length; i += 7) columns.push(slots.slice(i, i + 7));

  const box = compact ? "h-[11px] w-[11px]" : "h-[13px] w-[13px]";
  const gutter = compact ? "w-[9px] text-[7.5px]" : "w-[11px] text-[8.5px]";

  return (
    <div className={cn("inline-flex flex-col gap-1", className)}>
      {/* Month headers, above the column where each month first appears. */}
      <div className="flex gap-[3px] pl-[calc(var(--gutter)+3px)]" style={{ ["--gutter" as string]: compact ? "9px" : "11px" }}>
        {columns.map((col, ci) => {
          // Label the column where a month actually begins (a month can start
          // mid-column, so comparing only each column's first cell would drop
          // it entirely). The first column is always labelled for context.
          const filled = col.filter(Boolean) as HabitHeatCell[];
          const starter = filled.find((c) => c.id.slice(8, 10) === "01");
          const first = ci === 0 ? filled[0] : starter;
          const show = Boolean(first);
          return (
            <span
              key={`m-${ci}`}
              className={cn(
                "shrink-0 font-mono text-faint2",
                compact ? "w-[11px] text-[7.5px]" : "w-[13px] text-[8.5px]"
              )}
            >
              {show && first ? monthShort(first.id) : ""}
            </span>
          );
        })}
      </div>

      <div className="flex gap-[3px]">
        {/* Weekday gutter — alternate rows only, so it stays legible. */}
        <div className="flex flex-col gap-[3px]">
          {initials.map((letter, row) => (
            <span
              key={`d-${row}`}
              className={cn(
                "flex items-center justify-end font-mono leading-none text-faint2",
                box.split(" ")[0], // same height as a cell
                gutter
              )}
            >
              {row % 2 === 0 ? letter : ""}
            </span>
          ))}
        </div>

        {columns.map((col, ci) => (
          <div key={`c-${ci}`} className="flex flex-col gap-[3px]">
            {Array.from({ length: 7 }, (_, row) => {
              const cell = col[row];
              if (!cell) {
                return (
                  <span key={row} className={cn(box, "shrink-0")} aria-hidden />
                );
              }
              const cls = cn(box, "shrink-0 rounded-[3px]", interactive);
              const title = `${cell.id}${cell.isCurrent ? " · today" : ""}`;
              return onToggleDate ? (
                <button
                  key={row}
                  type="button"
                  title={title}
                  aria-label={title}
                  onClick={() => onToggleDate(cell.toggleDate)}
                  className={cls}
                  style={cellStyle(cell)}
                />
              ) : (
                <span
                  key={row}
                  title={title}
                  className={cls}
                  style={cellStyle(cell)}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
