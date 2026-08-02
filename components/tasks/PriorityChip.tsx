"use client";

import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import type { TaskPriority } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Short enough to sit in a list row without stealing space from the title. */
export const PRIORITY_SHORT: Record<TaskPriority, string> = {
  high: "HIGH",
  med: "MID",
  low: "LOW",
};

export const PRIORITY_COLOR: Record<TaskPriority, string> = {
  high: "oklch(0.64 0.18 25)",
  med: "oklch(0.7 0.12 70)",
  // The same blue the calendar already uses for low — cool and quiet next to
  // the warm high/mid pair.
  low: "oklch(0.62 0.12 245)",
};

const CHIP: Record<TaskPriority, string> = {
  high: "border-[oklch(0.64_0.18_25)]/45 bg-[oklch(0.64_0.18_25)]/12 text-[oklch(0.55_0.18_25)]",
  med: "border-[oklch(0.7_0.12_70)]/50 bg-[oklch(0.7_0.12_70)]/15 text-[oklch(0.5_0.11_70)]",
  low: "border-[oklch(0.62_0.12_245)]/40 bg-[oklch(0.62_0.12_245)]/10 text-[oklch(0.52_0.13_245)]",
};

const ICON = { high: ArrowUp, med: Minus, low: ArrowDown };

/**
 * The priority of a task, said out loud.
 *
 * Two forms in one element: the word on roomy layouts, and a bare arrow where
 * the row is too narrow to spend ~34px on a label — up for high, a flat dash
 * for mid, down for low. Which one shows is CSS, following the same
 * `.task-tag-full` / `.task-tag-mini` swap the rows already use, so the parent
 * decides by width without this component knowing anything about the viewport.
 *
 * Renders as a button when `onCycle` is given and a plain span otherwise —
 * some rows are wrapped in a link, where a nested button is invalid.
 */
export function PriorityChip({
  priority,
  onCycle,
  dimmed,
  className,
}: {
  priority: TaskPriority;
  onCycle?: () => void;
  dimmed?: boolean;
  className?: string;
}) {
  const label = PRIORITY_SHORT[priority];
  const Icon = ICON[priority];

  const body = (
    <>
      <span
        className={cn(
          "task-prio-text rounded-[4px] border px-1 py-[1px] font-mono text-[8.5px] font-bold leading-[13px] tracking-[0.06em] max-sm:hidden",
          CHIP[priority]
        )}
      >
        {label}
      </span>
      <span
        className="task-prio-icon hidden items-center justify-center max-sm:inline-flex"
        style={{ color: PRIORITY_COLOR[priority] }}
      >
        <Icon className="h-3 w-3" strokeWidth={3} />
      </span>
    </>
  );

  const classes = cn(
    "shrink-0 transition-colors",
    dimmed && "opacity-45",
    className
  );

  if (!onCycle) {
    return (
      <span className={classes} aria-label={`Priority ${label}`}>
        {body}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onCycle();
      }}
      title={`Priority: ${label} — click to change`}
      aria-label={`Priority ${label}`}
      className={cn(classes, "hover:brightness-95")}
    >
      {body}
    </button>
  );
}
