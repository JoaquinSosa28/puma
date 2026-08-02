import type { Task } from "@/lib/schemas";
import type { TaskPriority } from "@/lib/types";
import { meetingSortKey } from "@/lib/calendar-tasks";

const PRIORITY_RANK: Record<TaskPriority, number> = { high: 0, med: 1, low: 2 };

/**
 * Order a day's tasks so the most important open one is first.
 *
 * Finished tasks sink: they're a record of the day, not a decision you still
 * have to make, and leaving a ticked high-priority row pinned to the top would
 * bury the work that's actually left.
 *
 * Within a priority band anything carrying a clock time keeps its place in the
 * day, so a 09:00 and a 14:00 don't end up back to front. Everything else holds
 * the order it arrived in — the sort is stable, so it never reshuffles rows it
 * has no opinion about.
 */
export function sortTasksByPriority(tasks: Task[]): Task[] {
  return tasks
    .map((task, index) => ({ task, index }))
    .sort((a, b) => {
      const doneDelta =
        Number(a.task.status === "done") - Number(b.task.status === "done");
      if (doneDelta) return doneDelta;

      const rankDelta =
        PRIORITY_RANK[a.task.priority] - PRIORITY_RANK[b.task.priority];
      if (rankDelta) return rankDelta;

      const timeDelta = meetingSortKey(a.task.due) - meetingSortKey(b.task.due);
      if (timeDelta) return timeDelta;

      return a.index - b.index;
    })
    .map((entry) => entry.task);
}
