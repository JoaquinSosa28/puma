"use client";

import type { TaskPriority } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Short enough to sit in a list row without stealing space from the title. */
export const PRIORITY_SHORT: Record<TaskPriority, string> = {
  high: "HIGH",
  med: "MID",
  low: "LOW",
};

const CHIP: Record<TaskPriority, string> = {
  high: "border-[oklch(0.64_0.18_25)]/45 bg-[oklch(0.64_0.18_25)]/12 text-[oklch(0.55_0.18_25)]",
  med: "border-[oklch(0.7_0.12_70)]/50 bg-[oklch(0.7_0.12_70)]/15 text-[oklch(0.5_0.11_70)]",
  low: "border-border bg-surface2 text-faint",
};

const BASE =
  "shrink-0 rounded-[4px] border px-1 py-[1px] font-mono text-[8.5px] font-bold leading-[13px] tracking-[0.06em] transition-colors";

/**
 * The priority of a task, said out loud. A colour on its own needs a legend
 * nobody has; the word doesn't.
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
  const classes = cn(BASE, CHIP[priority], dimmed && "opacity-45", className);

  if (!onCycle) {
    return (
      <span className={classes} aria-label={`Priority ${label}`}>
        {label}
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
      {label}
    </button>
  );
}
