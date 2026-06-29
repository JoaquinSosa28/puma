"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Plus, X } from "lucide-react";
import type { Project, Subtask, Tag, Task } from "@/lib/schemas";
import {
  dueDatePart,
  mergeTaskDueDate,
  oid,
  taskDueDateInput,
} from "@/lib/date";
import { updateTaskDetail, moveTaskStatus } from "@/lib/actions/tasks";
import { toggleEntityTag } from "@/lib/actions/tags";
import { TagGridPicker } from "@/components/tags/TagGridPicker";
import { TaskTimer } from "@/components/tasks/TaskTimer";
import { DueQuickPick } from "@/components/shell/DueQuickPick";
import { cn } from "@/lib/utils";
import { useSyncedDraft } from "@/lib/use-synced-draft";

const STATUS_OPTIONS = [
  ["todo", "To do"],
  ["doing", "Doing"],
  ["done", "Done"],
] as const;

const PRIORITY_OPTIONS = [
  ["low", "Low", "var(--border)"],
  ["med", "Med", "oklch(0.7 0.12 70)"],
  ["high", "High", "oklch(0.64 0.18 25)"],
] as const;

type Props = {
  task: Task;
  tags: Tag[];
  projects: Project[];
  onClose: () => void;
  embedded?: boolean;
};

export function TaskDetailPanel({
  task,
  tags,
  projects,
  onClose,
  embedded = false,
}: Props) {
  const router = useRouter();
  const [title, setTitle] = useSyncedDraft(task.title, task.id);
  const [description, setDescription] = useSyncedDraft(task.description, task.id);
  const [subtasks, setSubtasks] = useSyncedDraft(task.subtasks, task.id);
  const [tagIds, setTagIds] = useSyncedDraft(task.tagIds, task.id);
  const [newSubtask, setNewSubtask] = useState("");
  const [status, setStatus] = useSyncedDraft(task.status, task.id);
  const [priority, setPriority] = useSyncedDraft(task.priority, task.id);
  const [dueDate, setDueDate] = useSyncedDraft(taskDueDateInput(task.due), task.id);
  const [, startTransition] = useTransition();

  const project = projects.find((p) => p.id === task.projectId);

  const persist = useCallback(
    (patch: {
      title?: string;
      description?: string;
      subtasks?: Subtask[];
      tagIds?: string[];
      priority?: Task["priority"];
      due?: string | null;
    }) => {
      startTransition(async () => {
        await updateTaskDetail({ id: task.id, ...patch });
        router.refresh();
      });
    },
    [router, task.id]
  );

  useEffect(() => {
    const handle = window.setTimeout(() => {
      if (description !== task.description) {
        persist({ description });
      }
    }, 500);
    return () => window.clearTimeout(handle);
  }, [description, task.description, persist]);

  const saveTitle = () => {
    const next = title.trim();
    if (next === task.title) return;
    if (!next) return;
    persist({ title: next });
  };

  const saveSubtasks = (next: Subtask[]) => {
    setSubtasks(next);
    persist({ subtasks: next });
  };

  const toggleSubtask = (id: string) => {
    saveSubtasks(
      subtasks.map((s) => (s.id === id ? { ...s, done: !s.done } : s))
    );
  };

  const updateSubtaskTitle = (id: string, value: string) => {
    setSubtasks((prev) =>
      prev.map((s) => (s.id === id ? { ...s, title: value } : s))
    );
  };

  const commitSubtaskTitle = (id: string) => {
    const item = subtasks.find((s) => s.id === id);
    if (!item) return;
    const nextTitle = item.title.trim();
    if (!nextTitle) {
      saveSubtasks(subtasks.filter((s) => s.id !== id));
      return;
    }
    if (nextTitle !== task.subtasks.find((s) => s.id === id)?.title) {
      saveSubtasks(
        subtasks.map((s) => (s.id === id ? { ...s, title: nextTitle } : s))
      );
    }
  };

  const addSubtask = () => {
    const text = newSubtask.trim();
    if (!text) return;
    const next = [...subtasks, { id: oid(), title: text, done: false }];
    setNewSubtask("");
    saveSubtasks(next);
  };

  const toggleTag = (tagId: string) => {
    startTransition(async () => {
      const res = await toggleEntityTag("task", task.id, tagId);
      if (res.ok && res.data) {
        setTagIds((prev) =>
          res.data!.applied
            ? [...prev, tagId]
            : prev.filter((id) => id !== tagId)
        );
        router.refresh();
      }
    });
  };

  const setTaskStatus = (next: Task["status"]) => {
    setStatus(next);
    startTransition(async () => {
      await moveTaskStatus(task.id, next);
      router.refresh();
    });
  };

  const setTaskPriority = (next: Task["priority"]) => {
    setPriority(next);
    persist({ priority: next });
  };

  const clearDueDate = () => {
    if (!task.due) return;
    setDueDate("");
    persist({ due: null });
  };

  const doneSubtasks = subtasks.filter((s) => s.done).length;
  const subtaskPct = subtasks.length
    ? Math.round((doneSubtasks / subtasks.length) * 100)
    : 0;

  return (
    <aside
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden bg-surface",
        embedded
          ? "rounded-none border-0 shadow-none"
          : "rounded-[13px] border border-border"
      )}
      style={embedded ? undefined : { boxShadow: "2px 2px 0 var(--shadow)" }}
    >
      <header className="flex items-start gap-2 border-b border-border2 bg-surface2/60 px-4 py-3">
        <div className="min-w-0 flex-1">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            className="w-full border-none bg-transparent p-0 text-lg font-bold text-ink outline-none placeholder:text-faint2"
            placeholder="Task title"
          />
          <div className="mt-1.5 flex flex-wrap gap-2 font-mono text-[10px] text-faint">
            {project && (
              <span className="flex items-center gap-1">
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: project.color }}
                />
                {project.title}
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border text-faint transition-colors hover:bg-hover hover:text-ink"
          aria-label="Close task detail"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {STATUS_OPTIONS.map(([value, label]) => {
            const active = status === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setTaskStatus(value)}
                className={cn(
                  "rounded-md border px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wide transition-colors",
                  active
                    ? "border-ink bg-ink text-background"
                    : "border-border bg-surface2 text-faint hover:border-faint hover:text-ink"
                )}
              >
                {label}
              </button>
            );
          })}
          <div className="ml-auto">
            <TaskTimer task={task} />
          </div>
        </div>

        <section className="mb-4">
          <h4 className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-widest text-faint2">
            Due date
          </h4>
          <DueQuickPick
            mode="due-optional"
            value={dueDate || null}
            onChange={(next) => {
              if (!next) {
                clearDueDate();
                return;
              }
              setDueDate(next);
              const nextDue = mergeTaskDueDate(next, task.due);
              if (nextDue !== (task.due ?? null)) {
                persist({ due: nextDue });
              }
            }}
          />
          {task.due?.includes("T") && (
            <p className="mt-1.5 font-mono text-[10px] text-faint">
              Time {dueDatePart(task.due)}
            </p>
          )}
        </section>

        <section className="mb-4">
          <h4 className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-widest text-faint2">
            Priority
          </h4>
          <div className="flex gap-1.5">
            {PRIORITY_OPTIONS.map(([value, label, color]) => {
              const active = priority === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTaskPriority(value)}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wide transition-all",
                    active
                      ? "border-2 text-ink shadow-[1px_1px_0_var(--shadow)]"
                      : "border-border bg-surface2 text-faint hover:border-faint"
                  )}
                  style={
                    active
                      ? {
                          borderColor: color,
                          background: color.includes("oklch")
                            ? color.replace(")", " / 0.12)")
                            : "var(--surface2)",
                        }
                      : undefined
                  }
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: color }}
                  />
                  {label}
                </button>
              );
            })}
          </div>
        </section>

        <section className="mb-5">
          <h4 className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-widest text-faint2">
            Description
          </h4>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add notes, context, links…"
            rows={4}
            className="w-full resize-y rounded-lg border border-border bg-surface2/50 px-3 py-2.5 text-[13px] leading-relaxed text-ink outline-none transition-colors placeholder:text-faint2 focus:border-faint"
          />
        </section>

        <section className="mb-5">
          <div className="mb-2 flex items-center gap-2">
            <h4 className="m-0 font-mono text-[10px] font-semibold uppercase tracking-widest text-faint2">
              Subtasks
            </h4>
            {subtasks.length > 0 && (
              <span className="font-mono text-[9px] text-faint2">
                {doneSubtasks}/{subtasks.length}
              </span>
            )}
          </div>
          {subtasks.length > 0 && (
            <div className="mb-2 h-1 overflow-hidden rounded-full bg-border2">
              <div
                className="h-full rounded-full bg-habits transition-[width] duration-200"
                style={{ width: `${subtaskPct}%` }}
              />
            </div>
          )}
          <div className="flex flex-col gap-1">
            {subtasks.map((sub) => (
              <div
                key={sub.id}
                className="flex items-center gap-2 rounded-lg px-1 py-1 hover:bg-surface2/70"
              >
                <button
                  type="button"
                  onClick={() => toggleSubtask(sub.id)}
                  className={cn(
                    "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border-[1.8px]",
                    sub.done
                      ? "border-none bg-habits"
                      : "border-border bg-transparent"
                  )}
                >
                  {sub.done && (
                    <Check className="h-[10px] w-[10px] text-white" strokeWidth={3.2} />
                  )}
                </button>
                <input
                  value={sub.title}
                  onChange={(e) => updateSubtaskTitle(sub.id, e.target.value)}
                  onBlur={() => commitSubtaskTitle(sub.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                  }}
                  className={cn(
                    "min-w-0 flex-1 border-none bg-transparent p-0 text-[13px] outline-none",
                    sub.done ? "text-faint2 line-through" : "text-ink"
                  )}
                />
              </div>
            ))}
            <div className="mt-1 flex items-center gap-2 rounded-lg border border-dashed border-border px-2 py-1.5">
              <Plus className="h-3.5 w-3.5 shrink-0 text-faint2" />
              <input
                value={newSubtask}
                onChange={(e) => setNewSubtask(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addSubtask();
                  }
                }}
                placeholder="Add subtask…"
                className="min-w-0 flex-1 border-none bg-transparent p-0 text-[13px] text-ink outline-none placeholder:text-faint2"
              />
            </div>
          </div>
        </section>

        <section>
          <h4 className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-widest text-faint2">
            Tags
          </h4>
          <TagGridPicker
            tags={tags}
            selectedTagIds={tagIds}
            onToggle={toggleTag}
          />
        </section>
      </div>
    </aside>
  );
}
