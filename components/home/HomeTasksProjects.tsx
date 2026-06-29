import type { Project, Task } from "@/lib/schemas";
import { projectProgress } from "@/lib/metrics";
import { TaskList } from "@/components/tasks/TaskList";
import type { Tag } from "@/lib/schemas";
import { iso } from "@/lib/date";
import { WidgetHeaderLink, WidgetRowLink } from "@/components/home/WidgetLink";
import { hrefWithLife, type LifeView } from "@/lib/life-area";
import { tasksListHref } from "@/lib/task-links";

type Props = {
  todayTasks: Task[];
  projects: Project[];
  allTasks: Task[];
  tags: Tag[];
  lifeView: LifeView;
};

export function HomeTasksProjects({
  todayTasks,
  projects,
  allTasks,
  tags,
  lifeView,
}: Props) {
  const td = iso();
  const today = todayTasks.filter((t) => (t.due ?? "").slice(0, 10) === td);
  const done = today.filter((t) => t.status === "done").length;
  const pct = today.length ? Math.round((done / today.length) * 100) : 0;

  return (
    <div className="flex min-h-0 flex-col gap-4">
      <section className="flex min-h-0 flex-[1.15] flex-col rounded-[13px] border border-border bg-surface px-[18px] py-[15px]">
        <WidgetHeaderLink href={tasksListHref(lifeView, "today")}>
          <span className="h-2.5 w-2.5 rounded-[3px] bg-tasks" />
          <h3 className="m-0 text-sm font-bold">Today&apos;s tasks</h3>
          <span className="font-mono text-[11px] text-faint">
            {done} of {today.length} done
          </span>
          <div className="ml-auto h-1.5 max-w-[140px] flex-1 overflow-hidden rounded-full bg-border2">
            <div
              className="h-full bg-tasks transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </WidgetHeaderLink>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <TaskList
            tasks={today}
            tags={tags}
            linkTaskDetail
            lifeView={lifeView}
          />
        </div>
      </section>

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[13px] border border-border bg-surface px-[18px] py-[15px]">
        <WidgetHeaderLink href={hrefWithLife("/projects", lifeView)}>
          <span className="h-2.5 w-2.5 rounded-[3px] bg-projects" />
          <h3 className="m-0 text-sm font-bold">Projects</h3>
          <span className="font-mono text-[11px] text-faint">
            {projects.length} active
          </span>
        </WidgetHeaderLink>
        <div className="flex flex-col gap-3">
          {projects.map((p) => {
            const prog = projectProgress(p.id, allTasks);
            return (
              <WidgetRowLink
                key={p.id}
                href={hrefWithLife(`/projects?project=${p.id}`, lifeView)}
                className="-mx-1 px-1 py-0.5"
              >
                <div className="mb-1.5 flex items-center gap-2 text-[13.5px] font-semibold">
                  <span
                    className="h-[9px] w-[9px] rounded-[2px]"
                    style={{ background: p.color }}
                  />
                  {p.title}
                  <span className="ml-auto font-mono text-[10px] text-faint">
                    {prog.label}
                  </span>
                </div>
                <div className="h-[7px] overflow-hidden rounded-full bg-border2">
                  <div
                    className="h-full"
                    style={{
                      width: `${prog.progress}%`,
                      background: p.color,
                    }}
                  />
                </div>
              </WidgetRowLink>
            );
          })}
        </div>
      </section>
    </div>
  );
}
