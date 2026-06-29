"use client";

import type { Habit } from "@/lib/schemas";
import { iso, type WeekStart } from "@/lib/date";
import {
  habitHeatCells,
  normalizeHabitFrequency,
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

export function HabitHeatStrip({
  habit,
  entries,
  visibility,
  weekStart = "mon",
  today = iso(),
  onToggleDate,
  compact = false,
  className,
}: Props) {
  const frequency = normalizeHabitFrequency(habit.frequency.type);
  const cells = habitHeatCells(frequency, visibility, entries, weekStart, today);

  const size =
    frequency === "monthly"
      ? compact
        ? "h-4 min-w-7 px-0.5"
        : "h-5 min-w-8 px-1"
      : frequency === "weekly"
        ? compact
          ? "h-3.5 min-w-5"
          : "h-4 min-w-6"
        : compact
          ? "h-[11px] w-[11px]"
          : "h-[13px] w-[13px]";

  return (
    <div
      className={cn(
        "flex flex-wrap items-center",
        frequency === "daily" && "gap-[3px]",
        frequency === "weekly" && "gap-1.5",
        frequency === "monthly" && "gap-2",
        className
      )}
    >
      {cells.map((cell, index) => {
        const sharedClass = cn(
          size,
          "rounded-[3px]",
          frequency !== "daily" && "shrink-0",
          frequency === "weekly" && index > 0 && index % 4 === 0 && "ml-3",
          onToggleDate &&
            "hover:outline hover:outline-2 hover:outline-faint2 hover:outline-offset-1"
        );
        const style = {
          background: cell.done ? "oklch(0.6 0.13 155)" : "var(--border2)",
          border: cell.done ? "none" : "1px solid var(--border)",
          outline: cell.isCurrent ? "2px solid var(--faint2)" : undefined,
          outlineOffset: cell.isCurrent ? "1px" : undefined,
        };

        if (onToggleDate) {
          return (
            <button
              key={cell.id}
              type="button"
              title={cell.label}
              onClick={() => onToggleDate(cell.toggleDate)}
              className={sharedClass}
              style={style}
            />
          );
        }

        return (
          <span
            key={cell.id}
            className={sharedClass}
            style={style}
            title={cell.label}
          />
        );
      })}
    </div>
  );
}
