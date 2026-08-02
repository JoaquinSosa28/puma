import type { Task } from "@/lib/schemas";
import type { TaskPriority } from "@/lib/types";
import { meetingSortKey } from "@/lib/calendar-tasks";

const PRIORITY_RANK: Record<TaskPriority, number> = { high: 0, med: 1, low: 2 };

/**
 * Order tasks by priority, highest first.
 *
 * Strictly by priority — done tasks are NOT sunk to the bottom. Sinking them
 * split the list into two priority runs, so a MID sitting under a LOW read as
 * a broken sort even though both runs were ordered. The strikethrough already
 * says a task is finished; the order shouldn't have to say it twice.
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
      const rankDelta =
        PRIORITY_RANK[a.task.priority] - PRIORITY_RANK[b.task.priority];
      if (rankDelta) return rankDelta;

      const timeDelta = meetingSortKey(a.task.due) - meetingSortKey(b.task.due);
      if (timeDelta) return timeDelta;

      return a.index - b.index;
    })
    .map((entry) => entry.task);
}
