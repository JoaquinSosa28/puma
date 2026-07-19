import { iso } from "@/lib/date";
import { hrefWithLife, type LifeView } from "@/lib/life-area";
import type { Task } from "@/lib/schemas";

export type TasksTab = "today" | "upcoming" | "all";

export function tasksListHref(
  lifeView: LifeView,
  tab: TasksTab = "today"
): string {
  return hrefWithLife(`/tasks?tab=${tab}`, lifeView);
}

export function taskDetailHref(
  task: Task,
  lifeView: LifeView,
  today = iso()
): string {
  const d = (task.due ?? "").slice(0, 10);
  const tab: TasksTab =
    d && d < today ? "today" : d === today ? "today" : d > today ? "upcoming" : "all";
  return hrefWithLife(`/tasks?tab=${tab}&task=${task.id}`, lifeView);
}
