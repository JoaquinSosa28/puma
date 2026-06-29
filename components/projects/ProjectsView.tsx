"use client";

import { useSearchParams } from "next/navigation";
import { useQueryState } from "nuqs";
import type { Goal, Project, Task, Tag } from "@/lib/schemas";
import { projectProgress } from "@/lib/metrics";
import { parseLifeView } from "@/lib/life-area";
import { Topbar } from "@/components/shell/Topbar";
import { KanbanBoard } from "@/components/projects/KanbanBoard";
import { ProjectDetailPanel } from "@/components/projects/ProjectDetailPanel";
import { NewProjectCard } from "@/components/projects/NewProjectCard";
import { cn } from "@/lib/utils";
import { lifeAreaForCreate } from "@/lib/life-area";

type Props = {
  projects: Project[];
  tasks: Task[];
  tags: Tag[];
  goals: Goal[];
  stats: { dayPct: number; habitsLabel: string; topStreak: number };
  birthDate?: string | null;
  lifeSpanYears?: number;
};

export function ProjectsView({
  projects,
  tasks,
  tags,
  goals,
  stats,
  birthDate = null,
  lifeSpanYears,
}: Props) {
  const searchParams = useSearchParams();
  const lifeView = parseLifeView(searchParams.get("life"));
  const [projectId, setProjectId] = useQueryState("project", {
    defaultValue: projects[0]?.id ?? "",
  });
  const selected = projects.find((p) => p.id === projectId) ?? projects[0];
  const spTasks = tasks.filter((t) => t.projectId === selected?.id);

  return (
    <>
      <Topbar
        title="Projects"
        dayPct={stats.dayPct}
        habitsLabel={stats.habitsLabel}
        topStreak={stats.topStreak}
        birthDate={birthDate}
        lifeSpanYears={lifeSpanYears}
        activeProject={
          selected
            ? { title: selected.title, color: selected.color }
            : undefined
        }
      />
      <div className="flex min-h-0 flex-1 flex-col pb-6 animate-puma-view">
        <div className="mb-4 flex flex-wrap gap-2">
          {projects.map((p) => {
            const prog = projectProgress(p.id, tasks);
            const active = p.id === selected?.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setProjectId(p.id)}
                className={cn(
                  "min-w-[160px] cursor-pointer rounded-[11px] border-[1.5px] p-[11px_14px] text-left hover:border-faint2",
                  active ? "" : "border-border bg-surface"
                )}
                style={
                  active
                    ? {
                        borderColor: p.color,
                        background: p.color.replace(")", " / 0.06)"),
                      }
                    : undefined
                }
              >
                <div className="mb-2 flex items-center gap-1.5 text-[13.5px] font-bold">
                  <span
                    className="h-[9px] w-[9px] rounded-[2px]"
                    style={{ background: p.color }}
                  />
                  {p.title}
                </div>
                <div className="mb-1.5 h-1.5 overflow-hidden rounded-full bg-border2">
                  <div
                    className="h-full"
                    style={{
                      width: `${prog.progress}%`,
                      background: p.color,
                    }}
                  />
                </div>
                <div className="flex justify-between font-mono text-[10px] text-faint">
                  <span>{prog.label}</span>
                  <span>{prog.progress}%</span>
                </div>
              </button>
            );
          })}
          <NewProjectCard
            lifeArea={lifeAreaForCreate(lifeView)}
            onCreated={(id) => void setProjectId(id)}
          />
        </div>

        {selected ? (
          <div className="grid min-h-0 flex-1 gap-4 overflow-hidden lg:grid-cols-[1fr_minmax(280px,320px)]">
            <div className="flex min-h-0 flex-col overflow-hidden rounded-[14px] border border-border bg-surface">
              <div className="flex shrink-0 items-center gap-2 border-b border-border2 px-4 py-3">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                  style={{ background: selected.color }}
                />
                <h3 className="m-0 text-sm font-bold">{selected.title}</h3>
                <span className="font-mono text-[10px] text-faint">kanban</span>
              </div>
              <div className="min-h-0 flex-1 overflow-hidden p-3">
                <KanbanBoard
                  tasks={spTasks}
                  tags={tags}
                  projectId={selected.id}
                  lifeView={lifeView}
                />
              </div>
            </div>
            <ProjectDetailPanel
              project={selected}
              goals={goals}
              tasks={tasks}
              onDeleted={() => {
                const remaining = projects.filter((p) => p.id !== selected.id);
                void setProjectId(remaining[0]?.id ?? null);
              }}
            />
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-[14px] border border-dashed border-border p-8 text-center">
            <p className="text-sm text-faint">No projects yet — create one to get started.</p>
            <NewProjectCard
              lifeArea={lifeAreaForCreate(lifeView)}
              onCreated={(id) => void setProjectId(id)}
              className="min-w-[220px]"
            />
          </div>
        )}
      </div>
    </>
  );
}
