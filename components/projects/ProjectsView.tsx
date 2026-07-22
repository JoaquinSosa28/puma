"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQueryState } from "nuqs";
import type { Goal, Project, Task, Tag } from "@/lib/schemas";
import { projectProgress } from "@/lib/metrics";
import { parseLifeView } from "@/lib/life-area";
import { Topbar } from "@/components/shell/Topbar";
import { KanbanBoard } from "@/components/projects/KanbanBoard";
import { ProjectDetailPanel } from "@/components/projects/ProjectDetailPanel";
import { TaskDetailPanel } from "@/components/tasks/TaskDetailPanel";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { NewProjectCard } from "@/components/projects/NewProjectCard";
import { ScrollHint } from "@/components/ui/scroll-hint";
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
  const railRef = useRef<HTMLDivElement>(null);

  // In-place task editing: ?task=<id> swaps the right panel for the task editor.
  const [taskId, setTaskId] = useQueryState("task");
  // Phone: project details live in a bottom sheet behind the Details button.
  const [detailsOpen, setDetailsOpen] = useState(false);
  const editingTask = taskId
    ? spTasks.find((t) => t.id === taskId) ?? null
    : null;

  // Drop a stale ?task (deleted task, or project switched) so the URL stays honest.
  useEffect(() => {
    if (taskId && !editingTask) void setTaskId(null);
  }, [taskId, editingTask, setTaskId]);

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
        <div className="relative mb-4">
          <div
            ref={railRef}
            className="flex snap-x gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]"
          >
          {projects.map((p) => {
            const prog = projectProgress(p.id, tasks);
            const active = p.id === selected?.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setProjectId(p.id)}
                className={cn(
                  "min-w-[160px] max-w-[240px] shrink-0 snap-start cursor-pointer rounded-[11px] border-[1.5px] p-[11px_14px] text-left hover:border-faint2",
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
                    className="h-[9px] w-[9px] shrink-0 rounded-[2px]"
                    style={{ background: p.color }}
                  />
                  <span className="min-w-0 truncate">{p.title}</span>
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
            className="shrink-0"
          />
          </div>
          <ScrollHint targetRef={railRef} direction="right" />
        </div>

        {selected ? (
          <div className="flex min-h-0 flex-1 flex-col gap-4 max-lg:gap-0 max-lg:overflow-hidden max-lg:pb-14 lg:grid lg:grid-cols-[1fr_minmax(280px,320px)] lg:overflow-hidden">
            <div className="flex min-h-0 flex-col overflow-hidden rounded-[14px] border border-border bg-surface max-lg:min-h-0 max-lg:flex-1">
              <div className="flex shrink-0 items-center gap-2 border-b border-border2 px-4 py-3">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                  style={{ background: selected.color }}
                />
                <h3 className="m-0 min-w-0 flex-1 truncate text-sm font-bold">
                  {selected.title}
                </h3>
                <span className="font-mono text-[10px] text-faint max-lg:hidden">
                  kanban
                </span>
                <span
                  className="font-mono text-[10px] font-bold lg:hidden"
                  style={{ color: selected.color }}
                >
                  {projectProgress(selected.id, tasks).progress}%
                </span>
                <button
                  type="button"
                  onClick={() => setDetailsOpen(true)}
                  className="shrink-0 rounded-lg border border-border px-2.5 py-1 text-[11px] font-semibold text-muted transition-all active:scale-95 lg:hidden"
                >
                  Details
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-hidden p-3">
                <KanbanBoard
                  tasks={spTasks}
                  tags={tags}
                  onEditTask={(id) => void setTaskId(id)}
                />
              </div>
            </div>
            {editingTask ? (
              // Phone: draggable bottom sheet; desktop: in-grid panel.
              <>
                <div
                  key={editingTask.id}
                  className="hidden min-h-0 overflow-hidden animate-puma-swap lg:block"
                >
                  <TaskDetailPanel
                    task={editingTask}
                    tags={tags}
                    projects={projects}
                    onClose={() => void setTaskId(null)}
                    onBack={{
                      label: selected.title,
                      action: () => void setTaskId(null),
                    }}
                  />
                </div>
                <div className="lg:hidden">
                  <BottomSheet open onClose={() => void setTaskId(null)}>
                    <TaskDetailPanel
                      task={editingTask}
                      tags={tags}
                      projects={projects}
                      onClose={() => void setTaskId(null)}
                      embedded
                    />
                  </BottomSheet>
                </div>
              </>
            ) : (
              <div className="hidden min-h-0 lg:block">
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
            )}
            {detailsOpen && (
              <div className="lg:hidden">
                <BottomSheet open onClose={() => setDetailsOpen(false)}>
                  <div className="h-full px-3 pb-4">
                    <ProjectDetailPanel
                      project={selected}
                      goals={goals}
                      tasks={tasks}
                      onDeleted={() => {
                        setDetailsOpen(false);
                        const remaining = projects.filter(
                          (p) => p.id !== selected.id
                        );
                        void setProjectId(remaining[0]?.id ?? null);
                      }}
                    />
                  </div>
                </BottomSheet>
              </div>
            )}
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
