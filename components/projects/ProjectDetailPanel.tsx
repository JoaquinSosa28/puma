"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import type { Goal, Project, Task } from "@/lib/schemas";
import { projectProgress } from "@/lib/metrics";
import { updateProjectDetail, deleteProjectAction } from "@/lib/actions/projects";
import { linkProjectToGoal } from "@/lib/actions/links";
import { GoalLinkField } from "@/components/links/GoalLinkField";
import { PROJECT_COLORS } from "@/lib/project-colors";
import { cn } from "@/lib/utils";
import { useSyncedDraft } from "@/lib/use-synced-draft";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { ScrollHint } from "@/components/ui/scroll-hint";
import { toast } from "sonner";

const LIFE_AREAS = [
  ["personal", "Personal"],
  ["work", "Work"],
] as const;

type Props = {
  project: Project;
  goals: Goal[];
  tasks: Task[];
  onDeleted?: () => void;
};

export function ProjectDetailPanel({ project, goals, tasks, onDeleted }: Props) {
  const router = useRouter();
  const confirm = useConfirm();
  const bodyRef = useRef<HTMLDivElement>(null);
  const [title, setTitle] = useSyncedDraft(project.title, project.id);
  const [description, setDescription] = useSyncedDraft(project.description, project.id);
  const [lifeArea, setLifeArea] = useSyncedDraft(project.lifeArea, project.id);
  const [color, setColor] = useSyncedDraft(project.color, project.id);
  const [, startTransition] = useTransition();

  const prog = projectProgress(project.id, tasks);
  const openTasks = tasks.filter(
    (t) => t.projectId === project.id && t.status !== "done"
  ).length;

  const persist = useCallback(
    (patch: {
      title?: string;
      description?: string;
      lifeArea?: Project["lifeArea"];
      color?: string;
    }) => {
      startTransition(async () => {
        await updateProjectDetail({ id: project.id, ...patch });
        router.refresh();
      });
    },
    [project.id, router]
  );

  useEffect(() => {
    const handle = window.setTimeout(() => {
      if (description !== project.description) {
        persist({ description });
      }
    }, 500);
    return () => window.clearTimeout(handle);
  }, [description, project.description, persist]);

  const saveTitle = () => {
    const next = title.trim();
    if (next === project.title) return;
    if (!next) return;
    persist({ title: next });
  };

  const handleDelete = async () => {
    const taskCount = tasks.filter((t) => t.projectId === project.id).length;
    const ok = await confirm({
      title: `Delete "${project.title}"?`,
      description:
        taskCount > 0
          ? `${taskCount} task${taskCount === 1 ? "" : "s"} will be kept but unlinked from this project.`
          : undefined,
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;

    startTransition(async () => {
      const res = await deleteProjectAction(project.id);
      if (!res.ok) {
        toast.error(res.error ?? "Could not delete project");
        return;
      }
      toast.success("Project deleted");
      onDeleted?.();
      router.refresh();
    });
  };

  return (
    <aside
      className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-[13px] border border-border bg-surface max-lg:shrink-0"
      style={{ boxShadow: "2px 2px 0 var(--shadow)" }}
    >
      <header className="border-b border-border2 bg-surface2/60 px-4 py-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={saveTitle}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          className="w-full border-none bg-transparent p-0 text-lg font-bold text-ink outline-none placeholder:text-faint2"
          placeholder="Project title"
        />
        <div className="mt-2 flex items-center gap-3 font-mono text-[10px] text-faint">
          <span>
            <span className="font-semibold text-ink">{prog.label}</span> tasks done
          </span>
          <span>{openTasks} open</span>
          <span className="font-semibold text-ink">{prog.progress}%</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border2">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${prog.progress}%`, background: color }}
          />
        </div>
      </header>

      <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <section className="mb-5">
          <h4 className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-widest text-faint2">
            Description
          </h4>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Goals, scope, links, context…"
            rows={5}
            className="w-full resize-y rounded-lg border border-border bg-surface2/50 px-3 py-2.5 text-[13px] leading-relaxed text-ink outline-none transition-colors placeholder:text-faint2 focus:border-faint"
          />
        </section>

        <section className="mb-5">
          <h4 className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-widest text-faint2">
            Life area
          </h4>
          <div className="flex gap-1.5">
            {LIFE_AREAS.map(([value, label]) => {
              const active = lifeArea === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setLifeArea(value);
                    persist({ lifeArea: value });
                  }}
                  className={cn(
                    "flex-1 rounded-lg border px-2 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wide transition-colors",
                    active
                      ? "border-ink bg-ink text-background"
                      : "border-border bg-surface2 text-faint hover:border-faint hover:text-ink"
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </section>

        <section className="mb-5">
          <h4 className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-widest text-faint2">
            Color
          </h4>
          <div className="flex flex-wrap gap-2">
            {PROJECT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                title="Set project color"
                onClick={() => {
                  setColor(c);
                  persist({ color: c });
                }}
                className={cn(
                  "h-7 w-7 rounded-lg border-2 transition-transform hover:scale-105",
                  color === c ? "border-ink" : "border-transparent"
                )}
                style={{ background: c }}
              />
            ))}
          </div>
        </section>

        <section>
          <h4 className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-widest text-faint2">
            Linked goal
          </h4>
          <GoalLinkField
            goals={goals}
            value={project.goalId}
            onChange={(goalId) =>
              startTransition(async () => {
                const res = await linkProjectToGoal(project.id, goalId);
                if (!res.ok) toast.error(res.error ?? "Could not link goal");
                router.refresh();
              })
            }
          />
        </section>

        <section className="pt-1">
          <button
            type="button"
            onClick={handleDelete}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-tasks/30 bg-tasks/[0.06] px-3 py-2 text-[13px] font-semibold text-tasks transition-colors hover:border-tasks/50 hover:bg-tasks/10"
          >
            <Trash2 className="h-4 w-4" />
            Delete project
          </button>
        </section>
      </div>
      <ScrollHint targetRef={bodyRef} direction="down" />
    </aside>
  );
}
