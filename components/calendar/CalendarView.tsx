"use client";

import Link from "next/link";
import { useQueryState, parseAsInteger } from "nuqs";
import type { Task, HabitEntry } from "@/lib/schemas";
import { iso } from "@/lib/date";
import {
  CALENDAR_PRIO,
  calendarPrioBg,
  isMeetingPast,
  isMeetingTask,
  meetingTimeLabel,
  sortCalendarDayTasks,
} from "@/lib/calendar-tasks";
import { TaskList } from "@/components/tasks/TaskList";
import type { Tag } from "@/lib/schemas";
import { Topbar } from "@/components/shell/Topbar";
import { useLifeView } from "@/components/shell/LifeAreaToggle";
import { taskDetailHref } from "@/lib/task-links";
import { cn } from "@/lib/utils";

const PRIO = CALENDAR_PRIO;

type Props = {
  tasks: Task[];
  habitEntries: HabitEntry[];
  tags: Tag[];
  stats: { dayPct: number; habitsLabel: string; topStreak: number };
  birthDate?: string | null;
  lifeSpanYears?: number;
};

export function CalendarView({
  tasks,
  habitEntries,
  tags,
  stats,
  birthDate = null,
  lifeSpanYears,
}: Props) {
  const [life] = useLifeView();
  const [offset, setOffset] = useQueryState("month", parseAsInteger.withDefault(0));
  const [selected, setSelected] = useQueryState("day", {
    defaultValue: iso(),
  });

  const td = iso();
  const base = new Date();
  base.setDate(1);
  base.setMonth(base.getMonth() + offset);
  const yy = base.getFullYear();
  const mm = base.getMonth();
  const monthLabel = base.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  const firstDow = (new Date(yy, mm, 1).getDay() + 6) % 7;
  const start = new Date(yy, mm, 1);
  start.setDate(1 - firstDow);

  const cells = [...Array(42)].map((_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const ds = iso(d);
    const inM = d.getMonth() === mm;
    const dts = sortCalendarDayTasks(
      tasks.filter((t) => (t.due ?? "").slice(0, 10) === ds)
    );
    const hc = habitEntries.filter((e) => e.date === ds).length;
    const isSel = ds === selected;
    const isTdy = ds === td;
    return {
      ds,
      day: d.getDate(),
      inM,
      dts,
      hc,
      isSel,
      isTdy,
    };
  });

  const selTasks = tasks.filter((t) => (t.due ?? "").slice(0, 10) === selected);
  const selLabel = new Date(selected + "T00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <>
      <Topbar
        title="Calendar"
        dayPct={stats.dayPct}
        habitsLabel={stats.habitsLabel}
        topStreak={stats.topStreak}
        birthDate={birthDate}
        lifeSpanYears={lifeSpanYears}
      />
      <div className="flex min-h-0 flex-1 gap-[18px] overflow-hidden pb-6 animate-puma-view">
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-[14px] border border-border bg-surface">
          <div className="flex items-center gap-3 px-5 py-4">
            <h3 className="m-0 min-w-[190px] text-lg font-extrabold tracking-tight">
              {monthLabel}
            </h3>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setOffset(offset - 1)}
                className="flex h-[30px] w-[30px] items-center justify-center rounded-lg border border-border text-muted hover:border-faint2"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={() => setOffset(offset + 1)}
                className="flex h-[30px] w-[30px] items-center justify-center rounded-lg border border-border text-muted hover:border-faint2"
              >
                ›
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                setOffset(0);
                setSelected(td);
              }}
              className="rounded-lg border border-border px-[11px] py-1.5 font-mono text-[11px] font-semibold text-muted"
            >
              Today
            </button>
            <div className="ml-auto flex items-center gap-3.5 font-mono text-[10px] text-faint">
              <span className="flex items-center gap-1.5">
                <span
                  className="h-2.5 w-3 shrink-0 rounded-sm border-l-2 border-primary bg-primary/10"
                  aria-hidden
                />
                meeting
              </span>
              <span className="flex items-center gap-1.5">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-[3px] border border-border"
                  aria-hidden
                />
                task
              </span>
              <span className="flex items-center gap-1">
                <span className="h-[5px] w-[5px] rounded-full bg-habits" />
                habit
              </span>
            </div>
          </div>
          <div className="grid grid-cols-7 px-4">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <div
                key={d}
                className="py-1.5 text-center font-mono text-[10px] text-faint2"
              >
                {d}
              </div>
            ))}
          </div>
          <div className="grid flex-1 grid-cols-7 grid-rows-6 gap-[5px] px-4 pb-4">
            {cells.map((c) => (
              <div
                key={c.ds}
                role="button"
                tabIndex={0}
                onClick={() => setSelected(c.ds)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelected(c.ds);
                  }
                }}
                className={cn(
                  "flex min-h-0 cursor-pointer flex-col overflow-hidden rounded-lg border p-[6px_7px] text-left",
                  c.isSel ? "border-primary bg-primary/[0.06]" : "border-border2",
                  c.inM ? "bg-surface" : "bg-transparent"
                )}
              >
                <div className="mb-0.5 flex items-center gap-1">
                  <span
                    className={cn(
                      "text-xs",
                      c.isTdy ? "font-bold text-primary" : c.inM ? "text-ink" : "text-faint2"
                    )}
                  >
                    {c.day}
                  </span>
                  {c.hc > 0 && (
                    <span className="ml-auto h-[5px] w-[5px] rounded-full bg-habits" />
                  )}
                </div>
                <div className="flex flex-col gap-0.5 overflow-hidden">
                  {c.dts.slice(0, 3).map((t) => {
                    if (isMeetingTask(t) && t.due) {
                      const past = isMeetingPast(t.due, c.ds);
                      const color = PRIO[t.priority];
                      return (
                        <span
                          key={t.id}
                          className="flex min-w-0 items-center gap-1 truncate rounded border-l-2 px-1 py-px text-[9px]"
                          style={{
                            borderColor: color,
                            background: calendarPrioBg(color),
                          }}
                        >
                          <span className="shrink-0 font-mono text-[8px] text-faint2">
                            {meetingTimeLabel(t.due)}
                          </span>
                          <Link
                            href={taskDetailHref(t, life, td)}
                            onClick={(e) => e.stopPropagation()}
                            className={cn(
                              "min-w-0 truncate font-medium hover:underline",
                              past ? "text-faint line-through" : "text-ink"
                            )}
                          >
                            {t.title}
                          </Link>
                        </span>
                      );
                    }
                    const done = t.status === "done";
                    return (
                      <span
                        key={t.id}
                        className="flex min-w-0 items-center gap-1 truncate text-[9px]"
                      >
                        <span
                          className={cn(
                            "h-2 w-2 shrink-0 rounded-[3px] border-[1.5px]",
                            done ? "border-none bg-habits" : "border-border"
                          )}
                          aria-hidden
                        />
                        <Link
                          href={taskDetailHref(t, life, td)}
                          onClick={(e) => e.stopPropagation()}
                          className={cn(
                            "min-w-0 truncate hover:underline",
                            done ? "text-faint line-through" : "text-ink"
                          )}
                        >
                          {t.title}
                        </Link>
                      </span>
                    );
                  })}
                  {c.dts.length > 3 && (
                    <span className="font-mono text-[9px] text-faint">
                      +{c.dts.length - 3} more
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex w-[300px] shrink-0 flex-col overflow-hidden rounded-[14px] border border-border bg-surface">
          <div className="border-b border-border2 px-[18px] py-4">
            <div className="mb-0.5 font-mono text-[10px] text-faint">
              SELECTED DAY
            </div>
            <h3 className="m-0 text-base font-bold">{selLabel}</h3>
          </div>
          <div className="flex flex-1 flex-col gap-1 overflow-y-auto px-[18px] py-3.5">
            {selTasks.length ? (
              <TaskList
                tasks={selTasks}
                tags={tags}
                variant="calendar"
                calendarDay={selected}
                linkTaskDetail
                lifeView={life}
              />
            ) : (
              <div className="px-1 py-2 text-[13px] text-faint">
                Nothing scheduled. Use the capture bar above.
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
