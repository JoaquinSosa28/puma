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

/** Weekday initials in display order for the chosen week start. */
function weekdayInitials(weekStart: WeekStart): string[] {
  return weekStart === "mon"
    ? ["M", "T", "W", "T", "F", "S", "S"]
    : ["S", "M", "T", "W", "T", "F", "S"];
}

function monthShort(isoDate: string): string {
  return new Date(isoDate + "T00:00").toLocaleDateString("en-US", {
    month: "short",
  });
}

/**
 * History for one habit, laid out so you can always tell WHICH box you're
 * about to click — it used to be an unlabelled run of identical squares.
 *
 *  • daily   → a month-calendar grid: weekdays across the top (all seven),
 *              one row per week, month name in the left gutter where the
 *              month turns over. Rows stretch to the full card width.
 *  • weekly  → one box per week showing its starting day, with the month
 *              printed above wherever it changes.
 *  • monthly → one box per month, showing the month.
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

  const labelClass = cn(
    "font-mono uppercase tracking-wide text-faint2",
    compact ? "text-[7.5px]" : "text-[9px]"
  );

  // ---- monthly: one wide box per month, labelled with the month ----
  if (frequency === "monthly") {
    return (
      <div className={cn("flex flex-wrap items-center gap-2", className)}>
        {cells.map((cell) => {
          const cls = cn(
            compact ? "h-5 min-w-[38px] px-1" : "h-6 min-w-[44px] px-1.5",
            "flex shrink-0 items-center justify-center rounded-[4px]",
            interactive
          );
          const content = (
            <span
              className={cn(
                "font-mono tabular-nums",
                compact ? "text-[8.5px]" : "text-[9.5px]",
                cell.done ? "font-bold text-white" : "text-faint"
              )}
            >
              {cell.label.split(" ")[0]}
            </span>
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
            <span key={cell.id} title={cell.label} className={cls} style={cellStyle(cell)}>
              {content}
            </span>
          );
        })}
      </div>
    );
  }

  // ---- weekly: a month caption sits above the box that starts a new month ----
  if (frequency === "weekly") {
    return (
      <div className={cn("flex flex-wrap items-end gap-1.5", className)}>
        {cells.map((cell, index) => {
          const prev = cells[index - 1];
          const showMonth =
            index === 0 || !prev || monthShort(prev.id) !== monthShort(cell.id);
          const cls = cn(
            compact ? "h-5 min-w-[26px] px-1" : "h-6 min-w-[30px] px-1",
            "flex w-full items-center justify-center rounded-[4px]",
            interactive
          );
          const content = (
            <span
              className={cn(
                "font-mono tabular-nums",
                compact ? "text-[8.5px]" : "text-[9.5px]",
                cell.done ? "font-bold text-white" : "text-faint"
              )}
            >
              {Number(cell.id.slice(8, 10))}
            </span>
          );

          return (
            <div key={cell.id} className="flex shrink-0 flex-col gap-0.5">
              <span className={cn(labelClass, "h-3 leading-3")}>
                {showMonth ? monthShort(cell.id) : ""}
              </span>
              {onToggleDate ? (
                <button
                  type="button"
                  title={cell.label}
                  onClick={() => onToggleDate(cell.toggleDate)}
                  className={cls}
                  style={cellStyle(cell)}
                >
                  {content}
                </button>
              ) : (
                <span title={cell.label} className={cls} style={cellStyle(cell)}>
                  {content}
                </span>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // ---- daily: a month calendar — weekdays across, one row per week ----
  const initials = weekdayInitials(weekStart);
  // Pad the front so the first row starts on the week's first day.
  const firstDow = (() => {
    const d = new Date(cells[0]!.id + "T00:00").getDay();
    return weekStart === "mon" ? (d + 6) % 7 : d;
  })();
  const slots: (HabitHeatCell | null)[] = [
    ...Array.from({ length: firstDow }, () => null),
    ...cells,
  ];
  const rows: (HabitHeatCell | null)[][] = [];
  for (let i = 0; i < slots.length; i += 7) rows.push(slots.slice(i, i + 7));

  const gutter = compact ? "w-6" : "w-7";
  const gap = compact ? "gap-[3px]" : "gap-1";
  // Full-width columns with a capped height: square cells at this width would
  // make a month-tall grid dominate the card.
  const cellBox = compact ? "h-[15px] w-full" : "h-[22px] w-full";

  return (
    <div className={cn("w-full", className)}>
      {/* Weekday header — all seven, aligned with the columns below. */}
      <div className={cn("flex items-center", gap)}>
        <span className={cn(gutter, "shrink-0")} aria-hidden />
        <div className={cn("grid flex-1 grid-cols-7", gap)}>
          {initials.map((letter, i) => (
            <span
              key={`h-${i}`}
              className={cn(labelClass, "text-center leading-4")}
            >
              {letter}
            </span>
          ))}
        </div>
      </div>

      <div className={cn("flex flex-col", gap)}>
        {rows.map((row, ri) => {
          // Month caption on the row where the month turns over (and row 0).
          const filled = row.filter(Boolean) as HabitHeatCell[];
          const starter = filled.find((c) => c.id.slice(8, 10) === "01");
          const captionCell = ri === 0 ? filled[0] : starter;

          return (
            <div key={`r-${ri}`} className={cn("flex items-center", gap)}>
              <span
                className={cn(
                  gutter,
                  "shrink-0 text-right",
                  labelClass,
                  "leading-none"
                )}
              >
                {captionCell ? monthShort(captionCell.id) : ""}
              </span>
              <div className={cn("grid flex-1 grid-cols-7", gap)}>
                {Array.from({ length: 7 }, (_, col) => {
                  const cell = row[col];
                  if (!cell) {
                    return (
                      <span
                        key={col}
                        className={cn(cellBox, "rounded-[3px]")}
                        aria-hidden
                      />
                    );
                  }
                  const cls = cn(cellBox, "rounded-[4px]", interactive);
                  const title = `${cell.id}${cell.isCurrent ? " · today" : ""}`;
                  return onToggleDate ? (
                    <button
                      key={col}
                      type="button"
                      title={title}
                      aria-label={title}
                      onClick={() => onToggleDate(cell.toggleDate)}
                      className={cls}
                      style={cellStyle(cell)}
                    />
                  ) : (
                    <span
                      key={col}
                      title={title}
                      className={cls}
                      style={cellStyle(cell)}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
