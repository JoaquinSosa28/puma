"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Play, Square } from "lucide-react";
import type { Task } from "@/lib/schemas";
import { toggleTaskTimer } from "@/lib/actions/task-timer";
import {
  formatDuration,
  formatDurationClock,
  taskElapsedSec,
} from "@/lib/time";
import { useTaskTimer } from "@/components/tasks/TaskTimerProvider";
import { TaskTimeEditDialog } from "@/components/tasks/TaskTimeEditDialog";
import { cn } from "@/lib/utils";

type Props = {
  task: Pick<Task, "id" | "title" | "timeSpentSec" | "timerStartedAt">;
  compact?: boolean;
  className?: string;
  stopPropagation?: boolean;
};

export function TaskTimer({
  task,
  compact = false,
  className,
  stopPropagation = false,
}: Props) {
  const router = useRouter();
  const { now } = useTaskTimer();
  const [pending, startTransition] = useTransition();
  const [editOpen, setEditOpen] = useState(false);

  const running = Boolean(task.timerStartedAt);
  const elapsed = taskElapsedSec(task, now);

  const guard = (e: React.SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleToggle = (e: React.MouseEvent) => {
    guard(e);
    startTransition(async () => {
      await toggleTaskTimer(task.id);
      router.refresh();
    });
  };

  return (
    <>
      <div
        className={cn("flex shrink-0 items-center gap-1", className)}
        onPointerDown={stopPropagation ? guard : undefined}
        onClick={stopPropagation ? guard : undefined}
      >
        <button
          type="button"
          disabled={pending}
          onClick={handleToggle}
          title={running ? "Stop timer" : "Start timer"}
          className={cn(
            "flex items-center justify-center rounded-md border transition-all",
            compact ? "h-6 w-6" : "h-7 w-7",
            running
              ? "border-primary bg-primary/20 text-primary shadow-[1px_1px_0_var(--primary)]"
              : "border-border bg-surface text-muted hover:border-faint hover:bg-surface2"
          )}
        >
          {running ? (
            <Square className={cn(compact ? "h-2.5 w-2.5" : "h-3 w-3")} fill="currentColor" />
          ) : (
            <Play className={cn(compact ? "h-2.5 w-2.5" : "h-3 w-3")} />
          )}
        </button>
        <button
          type="button"
          onClick={(e) => {
            guard(e);
            setEditOpen(true);
          }}
          title="Edit tracked time"
          className={cn(
            "task-time-chip rounded-md border px-1.5 py-0.5 font-mono transition-colors hover:border-faint hover:bg-surface2",
            compact ? "text-[10px]" : "text-[11px]",
            running
              ? "border-primary/40 bg-primary/10 font-semibold text-primary"
              : elapsed > 0
                ? "border-border text-faint"
                : "border-border text-faint2 max-sm:hidden"
          )}
        >
          {running
            ? formatDurationClock(elapsed)
            : elapsed > 0
              ? formatDuration(elapsed)
              : "0m"}
        </button>
      </div>
      <TaskTimeEditDialog
        task={task}
        open={editOpen}
        onOpenChange={setEditOpen}
        now={now}
      />
    </>
  );
}
