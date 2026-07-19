"use client";

import Link from "next/link";
import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import type { Task, Tag } from "@/lib/schemas";
import { tagBg } from "@/lib/parse";
import { dueDatePart } from "@/lib/date";
import { toggleTask, cycleTaskPriority, deleteTaskAction } from "@/lib/actions/tasks";
import { Taggable } from "@/components/tags/TagMenuProvider";
import { TaskTimer } from "@/components/tasks/TaskTimer";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { taskDetailHref } from "@/lib/task-links";
import type { LifeView } from "@/lib/life-area";
import { iso } from "@/lib/date";
import { useTimezone } from "@/components/shell/TimeZoneProvider";
import {
  CALENDAR_PRIO,
  calendarPrioBg,
  isMeetingPast,
  isMeetingTask,
  meetingTimeLabel,
  sortCalendarDayTasks,
} from "@/lib/calendar-tasks";

const PRIO_COLOR = {
  high: "oklch(0.64 0.18 25)",
  med: "oklch(0.7 0.12 70)",
  low: "var(--border)",
} as const;

const PRIO_BORDER = {
  high: "border-l-[oklch(0.64_0.18_25)]",
  med: "border-l-[oklch(0.7_0.12_70)]",
  low: "border-l-border",
} as const;

type Props = {
  tasks: Task[];
  tags: Tag[];
  showDelete?: boolean;
  dueField?: "short" | "full";
  linkRowsTo?: string;
  linkTaskDetail?: boolean;
  lifeView?: LifeView;
  variant?: "default" | "page" | "calendar";
  calendarDay?: string;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
};

const STATUS_STYLE = {
  todo: "border-border bg-surface2 text-faint",
  doing: "border-primary/40 bg-primary/10 text-primary",
  done: "border-habits/40 bg-habits/10 text-habits",
} as const;

function SubtaskProgress({ done, total }: { done: number; total: number }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="mt-1 flex items-center gap-2">
      <div className="h-1 max-w-[100px] flex-1 overflow-hidden rounded-full bg-border2">
        <div
          className="h-full rounded-full bg-habits transition-[width] duration-200"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="shrink-0 font-mono text-[9px] tabular-nums text-faint2">
        {done}/{total}
      </span>
    </div>
  );
}

export function TaskList({
  tasks,
  tags,
  showDelete = false,
  dueField = "short",
  linkRowsTo,
  linkTaskDetail = false,
  lifeView,
  variant = "default",
  calendarDay,
  selectedId,
  onSelect,
}: Props) {
  const router = useRouter();
  const [optimistic, setOptimistic] = useOptimistic(tasks);
  const [, startTransition] = useTransition();

  const tagMap = new Map(tags.map((t) => [t.id, t]));
  const isPage = variant === "page";
  const isCalendar = variant === "calendar";
  const compact = isPage && Boolean(onSelect);
  const timeZone = useTimezone();
  const today = iso(new Date(), timeZone);
  const day = calendarDay ?? today;

  const listed = isCalendar ? sortCalendarDayTasks(optimistic) : optimistic;

  const handleToggle = (id: string) => {
    startTransition(async () => {
      setOptimistic(
        optimistic.map((t) =>
          t.id === id
            ? {
                ...t,
                status: t.status === "done" ? "todo" : "done",
              }
            : t
        )
      );
      await toggleTask(id);
      router.refresh();
    });
  };

  const handlePrio = (id: string) => {
    startTransition(async () => {
      await cycleTaskPriority(id);
      router.refresh();
    });
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      const res = await deleteTaskAction(id);
      if (res.ok) {
        toast.success("Task deleted", {
          action: res.undo
            ? {
                label: "UNDO",
                onClick: () => router.refresh(),
              }
            : undefined,
        });
      }
      router.refresh();
    });
  };

  return (
    <div className={cn("flex flex-col", isPage || isCalendar ? "gap-1" : "gap-px")}>
      {listed.map((t) => {
        const done = t.status === "done";
        const taskTags = t.tagIds
          .map((id) => tagMap.get(id))
          .filter(Boolean) as Tag[];
        const due =
          dueField === "full"
            ? dueDatePart(t.due)
            : t.due?.includes("T")
              ? t.due.split("T")[1]
              : dueDatePart(t.due);

        const selected = selectedId === t.id;
        const subtaskDone = t.subtasks.filter((s) => s.done).length;
        const subtaskTotal = t.subtasks.length;

        const titleClass = cn(
          compact ? "text-[15px] font-semibold leading-snug" : "text-sm",
          "truncate",
          done ? "text-faint2 line-through" : "text-ink"
        );

        if (isCalendar && isMeetingTask(t) && t.due) {
          const past = isMeetingPast(t.due, day, new Date(), timeZone);
          const color = CALENDAR_PRIO[t.priority];
          const detailHref =
            linkTaskDetail && lifeView
              ? taskDetailHref(t, lifeView, today)
              : null;
          return (
            <Taggable
              key={t.id}
              entity="task"
              id={t.id}
              tagIds={t.tagIds}
              lifeArea={t.lifeArea}
              className="flex gap-2 rounded-lg px-1 py-1.5 hover:bg-surface2"
            >
              <span className="w-10 shrink-0 pt-px font-mono text-[11px] tabular-nums text-faint2">
                {meetingTimeLabel(t.due)}
              </span>
              <div
                className="min-w-0 flex-1 rounded-r-md border-l-2 py-0.5 pl-2"
                style={{
                  borderColor: color,
                  background: calendarPrioBg(color),
                }}
              >
                {detailHref ? (
                  <Link
                    href={detailHref}
                    className={cn(
                      "block min-w-0 truncate text-[13px] font-medium hover:underline",
                      past ? "text-faint line-through" : "text-ink"
                    )}
                  >
                    {t.title}
                  </Link>
                ) : (
                  <span
                    className={cn(
                      "block truncate text-[13px] font-medium",
                      past ? "text-faint line-through" : "text-ink"
                    )}
                  >
                    {t.title}
                  </span>
                )}
              </div>
            </Taggable>
          );
        }

        if (isCalendar) {
          const detailHref =
            linkTaskDetail && lifeView
              ? taskDetailHref(t, lifeView, today)
              : null;
          return (
            <Taggable
              key={t.id}
              entity="task"
              id={t.id}
              tagIds={t.tagIds}
              lifeArea={t.lifeArea}
              className="flex items-center gap-2.5 rounded-lg px-1.5 py-2 hover:bg-surface2"
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggle(t.id);
                }}
                className={cn(
                  "flex h-[17px] w-[17px] shrink-0 items-center justify-center rounded-[5px] border-[1.8px]",
                  done ? "border-none bg-habits" : "border-border bg-transparent"
                )}
              >
                {done && (
                  <Check
                    className="h-[11px] w-[11px] animate-puma-pop text-white"
                    strokeWidth={3.2}
                  />
                )}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrio(t.id);
                }}
                title="priority"
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: PRIO_COLOR[t.priority] }}
              />
              {detailHref ? (
                <Link
                  href={detailHref}
                  className={cn(
                    "min-w-0 flex-1 truncate text-[13px] hover:underline",
                    done ? "text-faint2 line-through" : "text-ink"
                  )}
                >
                  {t.title}
                </Link>
              ) : (
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate text-[13px]",
                    done ? "text-faint2 line-through" : "text-ink"
                  )}
                >
                  {t.title}
                </span>
              )}
            </Taggable>
          );
        }

        const accentBorder = isPage
          ? t.status === "doing"
            ? "border-l-[3px] border-l-primary"
            : `border-l-[3px] ${PRIO_BORDER[t.priority]}`
          : "";

        const rowClass = cn(
          "grid items-center",
          compact
            ? cn(
                "cursor-pointer gap-x-2.5 border-b border-border2 px-3 py-2.5 last:border-b-0",
                showDelete
                  ? "grid-cols-[20px_minmax(0,1fr)_72px_28px]"
                  : "grid-cols-[20px_minmax(0,1fr)_72px]",
                selected
                  ? "border-l-[3px] border-l-tasks bg-tasks/[0.12] ring-1 ring-inset ring-tasks/35"
                  : cn("hover:bg-surface2/50", accentBorder)
              )
            : cn(
                "gap-x-[11px]",
                isPage
                  ? "border-b border-border2 px-4 py-2.5 last:border-b-0 hover:bg-surface2/70"
                  : "rounded-lg px-1 py-1 hover:bg-surface2",
                showDelete
                  ? "grid-cols-[18px_8px_minmax(0,1fr)_92px_52px_16px]"
                  : "grid-cols-[18px_8px_minmax(0,1fr)_92px_52px]",
                isPage && t.status === "doing" && "bg-primary/[0.03]",
                selected && "border-l-[3px] border-l-tasks bg-tasks/[0.12] ring-1 ring-inset ring-tasks/35",
                !selected && accentBorder
              )
        );

        const openDetail = () => onSelect?.(t.id);

        const rowHref = linkTaskDetail && lifeView
          ? taskDetailHref(t, lifeView, today)
          : linkRowsTo;

        return (
          <Taggable
            key={t.id}
            entity="task"
            id={t.id}
            tagIds={t.tagIds}
            lifeArea={t.lifeArea}
            className={rowClass}
            onClick={compact ? openDetail : undefined}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleToggle(t.id);
              }}
              className={cn(
                "flex shrink-0 items-center justify-center rounded-[5px] border-[1.8px]",
                isPage ? "h-5 w-5" : "h-[18px] w-[18px]",
                done
                  ? "border-none bg-habits"
                  : "border-border bg-transparent"
              )}
            >
              {done && (
                <Check className="h-[11px] w-[11px] animate-puma-pop text-white" strokeWidth={3.2} />
              )}
            </button>

            {!compact && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrio(t.id);
                }}
                title="priority"
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: PRIO_COLOR[t.priority] }}
              />
            )}

            <div
              className={cn(
                "min-w-0",
                !compact && "flex min-w-0 items-center gap-1.5 overflow-hidden",
                !compact && onSelect && "cursor-pointer"
              )}
              onClick={
                !compact && onSelect
                  ? (e) => {
                      e.stopPropagation();
                      openDetail();
                    }
                  : undefined
              }
              onKeyDown={
                !compact && onSelect
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openDetail();
                      }
                    }
                  : undefined
              }
              role={!compact && onSelect ? "button" : undefined}
              tabIndex={!compact && onSelect ? 0 : undefined}
            >
              {!compact && isPage && (
                <span
                  className={cn(
                    "shrink-0 rounded-md border px-1.5 py-px font-mono text-[9px] font-bold uppercase tracking-wide",
                    STATUS_STYLE[t.status]
                  )}
                >
                  {t.status}
                </span>
              )}
              {rowHref ? (
                <Link
                  href={rowHref}
                  className="flex min-w-0 flex-1 flex-nowrap items-center gap-1.5 overflow-hidden hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className={cn(titleClass, "min-w-0 flex-1 truncate")}>
                    {t.title}
                  </span>
                  {!compact && subtaskTotal > 0 && (
                    <span className="shrink-0 font-mono text-[9px] text-faint2">
                      {subtaskDone}/{subtaskTotal}
                    </span>
                  )}
                  {!compact &&
                    taskTags.map((tg) => (
                      <span
                        key={tg.id}
                        className="shrink-0 rounded-[5px] px-[7px] py-0.5 font-mono text-[10px] no-underline"
                        style={{ color: tg.color, background: tagBg(tg.color) }}
                      >
                        {tg.name}
                      </span>
                    ))}
                </Link>
              ) : (
                <>
                  <span className={cn(titleClass, "block truncate")}>{t.title}</span>
                  {compact && subtaskTotal > 0 && (
                    <SubtaskProgress done={subtaskDone} total={subtaskTotal} />
                  )}
                  {!compact &&
                    taskTags.map((tg) => (
                      <span
                        key={tg.id}
                        className="mt-1 inline shrink-0 rounded-[5px] px-[7px] py-0.5 font-mono text-[10px]"
                        style={{ color: tg.color, background: tagBg(tg.color) }}
                      >
                        {tg.name}
                      </span>
                    ))}
                </>
              )}
            </div>

            {compact ? (
              <div
                className="flex flex-col items-end justify-center gap-0.5"
                onClick={(e) => e.stopPropagation()}
              >
                <TaskTimer
                  task={t}
                  compact
                  stopPropagation={Boolean(rowHref || onSelect)}
                />
                <span className="font-mono text-[10px] tabular-nums text-faint">
                  {due}
                </span>
              </div>
            ) : (
              <>
                <div
                  className="flex justify-end"
                  onClick={(e) => e.stopPropagation()}
                >
                  <TaskTimer
                    task={t}
                    compact
                    stopPropagation={Boolean(rowHref || onSelect)}
                  />
                </div>
                <span
                  className={cn(
                    "text-right font-mono tabular-nums text-faint",
                    isPage ? "text-[11px]" : "text-[10px]"
                  )}
                >
                  {due}
                </span>
              </>
            )}

            {showDelete && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(t.id);
                }}
                className={cn(
                  "leading-none text-faint2 transition-colors hover:bg-surface2 hover:text-ink",
                  isPage
                    ? "flex h-6 w-6 items-center justify-center rounded-md text-lg"
                    : "px-0.5 text-[15px]"
                )}
                title="delete"
              >
                ×
              </button>
            )}
          </Taggable>
        );
      })}
    </div>
  );
}
