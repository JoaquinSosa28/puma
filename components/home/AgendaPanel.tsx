"use client";

import Link from "next/link";
import { useQueryState } from "nuqs";
import {
  iso,
  weekDates,
  dowLetters,
  parseTimeToMinutes,
  type WeekStart,
} from "@/lib/date";
import type { AgendaItem, Task } from "@/lib/schemas";
import { WidgetHeaderLink } from "@/components/home/WidgetLink";
import { AgendaTodayList } from "@/components/home/AgendaTodayList";
import { CarryoverSection } from "@/components/tasks/CarryoverSection";
import { cn } from "@/lib/utils";
import { hrefWithLife, type LifeView } from "@/lib/life-area";
import { taskDetailHref, tasksListHref } from "@/lib/task-links";
import { Taggable } from "@/components/tags/TagMenuProvider";
import { useTimezone } from "@/components/shell/TimeZoneProvider";

const PRIO_COLOR = {
  high: "oklch(0.64 0.18 25)",
  med: "oklch(0.7 0.12 70)",
  low: "oklch(0.58 0.14 245)",
} as const;

function taskTimeLabel(due: string | null): string {
  if (!due) return "—";
  if (due.includes("T")) return due.split("T")[1]?.slice(0, 5) ?? "—";
  return "all day";
}

function taskSortKey(due: string | null): number {
  if (!due?.includes("T")) return 9999;
  return parseTimeToMinutes(due.split("T")[1] ?? "00:00");
}

function AgendaDayTasks({
  tasks,
  lifeView,
  today,
}: {
  tasks: Task[];
  lifeView: LifeView;
  today: string;
}) {
  const sorted = [...tasks].sort(
    (a, b) => taskSortKey(a.due) - taskSortKey(b.due)
  );

  if (!sorted.length) {
    return (
      <p className="py-2 font-mono text-[11px] text-faint2">Nothing scheduled</p>
    );
  }

  return (
    <div className="mb-4 flex flex-1 flex-col gap-0.5">
      {sorted.map((task) => (
        <Taggable
          key={task.id}
          entity="task"
          id={task.id}
          tagIds={task.tagIds}
        >
          <Link
            href={taskDetailHref(task, lifeView, today)}
            className="-mx-1 block rounded-lg px-1 py-0.5 transition-colors hover:bg-hover"
          >
            <div className="flex gap-2">
              <span className="w-10 shrink-0 pt-px font-mono text-[11px] text-faint2">
                {taskTimeLabel(task.due)}
              </span>
              <div
                className="flex-1 border-l-2 py-0 pl-[11px]"
                style={{ borderColor: PRIO_COLOR[task.priority] }}
              >
                <div className="text-[13px] font-semibold">{task.title}</div>
                <div className="text-[11px] capitalize text-faint">
                  {task.status} · {task.priority}
                </div>
              </div>
            </div>
          </Link>
        </Taggable>
      ))}
    </div>
  );
}

type Props = {
  agenda: AgendaItem[];
  carryover: Task[];
  tasks: Task[];
  lifeView: LifeView;
  weekStart?: WeekStart;
};

export function AgendaPanel({
  agenda,
  carryover,
  tasks,
  lifeView,
  weekStart = "mon",
}: Props) {
  const timeZone = useTimezone();
  const td = iso(new Date(), timeZone);
  const [selectedDay, setSelectedDay] = useQueryState("day", {
    defaultValue: td,
  });
  const week = weekDates(new Date(), weekStart, timeZone);
  const letters = dowLetters(weekStart);
  const isToday = selectedDay === td;
  const calendarHref = hrefWithLife(`/calendar?day=${selectedDay}`, lifeView);

  const selectedDate = new Date(selectedDay + "T00:00");
  const headerDate = selectedDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const sectionLabel = isToday
    ? "TODAY"
    : selectedDate
        .toLocaleDateString("en-US", { weekday: "short" })
        .toUpperCase();

  const dayTasks = tasks.filter(
    (t) => (t.due ?? "").slice(0, 10) === selectedDay
  );

  return (
    <section className="flex flex-col overflow-hidden rounded-[13px] border border-border bg-surface">
      <div className="px-4 pb-3 pt-[15px]">
        <WidgetHeaderLink href={calendarHref}>
          <h3 className="m-0 text-sm font-bold">Agenda</h3>
          <span className="ml-auto font-mono text-[11px] text-faint">
            {headerDate}
          </span>
        </WidgetHeaderLink>
        <div className="grid grid-cols-7 gap-1">
          {week.map((d, i) => (
            <div
              key={`dow-${iso(d, timeZone)}`}
              className="text-center font-mono text-[9px] text-faint2"
            >
              {letters[i]}
            </div>
          ))}
          {week.map((d) => {
            const dayIso = iso(d, timeZone);
            const isSelected = dayIso === selectedDay;
            const isDayToday = dayIso === td;
            return (
              <button
                key={`day-${dayIso}`}
                type="button"
                onClick={() => setSelectedDay(dayIso)}
                className={cn(
                  "rounded-lg py-1.5 text-center text-xs transition-colors",
                  isSelected
                    ? "bg-ink font-bold text-background"
                    : isDayToday
                      ? "font-semibold text-ink ring-1 ring-border hover:bg-hover"
                      : "font-normal text-muted hover:bg-hover"
                )}
              >
                {d.getDate()}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex flex-1 flex-col overflow-y-auto px-4 pb-3.5">
        {isToday && carryover.length > 0 && (
          <CarryoverSection
            tasks={carryover}
            variant="agenda"
            href={tasksListHref(lifeView, "today")}
            taskHref={(task) => taskDetailHref(task, lifeView, td)}
            className="mb-3.5"
          />
        )}
        <Link
          href={calendarHref}
          className="mb-2.5 inline-block font-mono text-[10px] tracking-widest text-faint2 transition-colors hover:text-faint"
        >
          {sectionLabel}
        </Link>
        {isToday ? (
          <AgendaTodayList agenda={agenda} href={calendarHref} live />
        ) : (
          <AgendaDayTasks tasks={dayTasks} lifeView={lifeView} today={td} />
        )}
      </div>
    </section>
  );
}
