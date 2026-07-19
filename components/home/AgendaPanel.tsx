"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useQueryState } from "nuqs";
import { CalendarPlus, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import {
  addDays,
  iso,
  weekDates,
  dowLetters,
  parseTimeToMinutes,
  type WeekStart,
} from "@/lib/date";
import type { AgendaItem, Task } from "@/lib/schemas";
import { addMeetingAction, deleteAgendaItemAction } from "@/lib/actions/agenda";
import { WidgetHeaderLink } from "@/components/home/WidgetLink";
import { AgendaTodayList } from "@/components/home/AgendaTodayList";
import { CarryoverSection } from "@/components/tasks/CarryoverSection";
import { cn } from "@/lib/utils";
import { hrefWithLife, lifeAreaForCreate, type LifeView } from "@/lib/life-area";
import { taskDetailHref, tasksListHref } from "@/lib/task-links";
import { Taggable } from "@/components/tags/TagMenuProvider";
import { useTimezone } from "@/components/shell/TimeZoneProvider";

/** Carryover window: overdue tasks older than this many days stop nagging here. */
const CARRYOVER_DAYS = 7;

const MEETING_DURATIONS = [15, 30, 45, 60, 90] as const;

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
          lifeArea={task.lifeArea}
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
  const router = useRouter();
  const [, startTransition] = useTransition();
  const timeZone = useTimezone();
  const td = iso(new Date(), timeZone);
  const [selectedDay, setSelectedDay] = useQueryState("day", {
    defaultValue: td,
  });

  // Only nag about the recent past — anything older than a week is stale noise.
  const carryoverCutoff = iso(addDays(-CARRYOVER_DAYS, new Date(), timeZone), timeZone);
  const recentCarryover = carryover.filter(
    (t) => (t.due ?? "").slice(0, 10) >= carryoverCutoff
  );

  // Routine items (date null) repeat daily; dated items (meetings) pin to a day.
  const agendaFor = (day: string) =>
    agenda.filter((a) => !a.date || a.date === day);
  const meetingsFor = (day: string) =>
    agenda.filter((a) => a.kind === "meeting" && a.date === day);

  const deleteMeeting = (id: string) => {
    startTransition(async () => {
      const res = await deleteAgendaItemAction(id);
      if (!res.ok) toast.error(res.error ?? "Could not remove meeting");
      else router.refresh();
    });
  };
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
    <section className="flex flex-col overflow-hidden rounded-[13px] border border-border bg-surface max-lg:max-h-[70vh] max-lg:shrink-0">
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
        {isToday && recentCarryover.length > 0 && (
          <CarryoverSection
            tasks={recentCarryover}
            variant="agenda"
            href={tasksListHref(lifeView, "today")}
            taskHref={(task) => taskDetailHref(task, lifeView, td)}
            className="mb-3.5"
          />
        )}
        <div className="mb-2.5 flex items-center gap-2">
          <Link
            href={calendarHref}
            className="inline-block font-mono text-[10px] tracking-widest text-faint2 transition-colors hover:text-faint"
          >
            {sectionLabel}
          </Link>
          <AgendaActions selectedDay={selectedDay} lifeView={lifeView} />
        </div>
        {isToday ? (
          <AgendaTodayList
            agenda={agendaFor(td)}
            href={calendarHref}
            live
            onDeleteItem={deleteMeeting}
          />
        ) : (
          <>
            <DayMeetings
              meetings={meetingsFor(selectedDay)}
              onDelete={deleteMeeting}
            />
            <AgendaDayTasks tasks={dayTasks} lifeView={lifeView} today={td} />
          </>
        )}
      </div>
    </section>
  );
}

/** Dated meetings shown on a non-today day, above that day's tasks. */
function DayMeetings({
  meetings,
  onDelete,
}: {
  meetings: AgendaItem[];
  onDelete: (id: string) => void;
}) {
  if (!meetings.length) return null;
  const sorted = [...meetings].sort(
    (a, b) => parseTimeToMinutes(a.time) - parseTimeToMinutes(b.time)
  );
  return (
    <div className="mb-2 flex flex-col gap-0.5">
      {sorted.map((m) => (
        <div key={m.id} className="group relative -mx-1 rounded-lg px-1 py-0.5">
          <div className="flex gap-2">
            <span className="w-10 shrink-0 pt-px font-mono text-[11px] text-faint2">
              {m.time}
            </span>
            <div
              className="flex-1 border-l-2 pl-[11px]"
              style={{ borderColor: m.color }}
            >
              <div className="text-[13px] font-semibold">{m.title}</div>
              <div className="text-[11px] text-faint">{m.sub}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onDelete(m.id)}
            aria-label={`Remove meeting ${m.title}`}
            className="absolute right-0 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-md text-faint2 opacity-0 transition-all hover:bg-tasks/10 hover:text-tasks group-hover:opacity-100 focus-visible:opacity-100"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  );
}

/** "+ Meeting" inline form + the future calendar-sync placeholder. */
function AgendaActions({
  selectedDay,
  lifeView,
}: {
  selectedDay: string;
  lifeView: LifeView;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("10:00");
  const [duration, setDuration] = useState<number>(30);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    startTransition(async () => {
      const res = await addMeetingAction({
        title: trimmed,
        date: selectedDay,
        time,
        durationMins: duration,
        lifeArea: lifeAreaForCreate(lifeView),
      });
      if (!res.ok) {
        toast.error(res.error ?? "Could not add meeting");
        return;
      }
      toast.success(`Meeting at ${time}`);
      setTitle("");
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <div className="ml-auto flex items-center gap-1">
      {open ? (
        <div className="flex items-center gap-1">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
              if (e.key === "Escape") {
                setOpen(false);
                setTitle("");
              }
            }}
            placeholder="Meeting title"
            maxLength={200}
            disabled={pending}
            className="w-32 rounded-md border border-border bg-background px-1.5 py-0.5 text-[11px] text-ink outline-none placeholder:text-faint2 focus:border-faint"
          />
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            disabled={pending}
            className="rounded-md border border-border bg-background px-1 py-0.5 font-mono text-[10px] text-ink outline-none focus:border-faint"
          />
          <select
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            disabled={pending}
            className="rounded-md border border-border bg-background px-1 py-0.5 font-mono text-[10px] text-ink outline-none focus:border-faint"
          >
            {MEETING_DURATIONS.map((d) => (
              <option key={d} value={d}>
                {d}m
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={submit}
            disabled={pending || !title.trim()}
            className="rounded-md bg-ink px-2 py-0.5 text-[10px] font-bold text-background disabled:opacity-50"
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setTitle("");
            }}
            disabled={pending}
            aria-label="Cancel meeting"
            className="flex h-5 w-5 items-center justify-center rounded-md text-faint hover:bg-hover hover:text-ink"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[10px] font-semibold text-faint transition-colors hover:bg-hover hover:text-ink"
          >
            <CalendarPlus className="h-3 w-3" />
            Meeting
          </button>
          <button
            type="button"
            disabled
            title="Calendar sync (Google, iCal) is coming soon"
            className="flex cursor-not-allowed items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[10px] text-faint2"
          >
            <RefreshCw className="h-3 w-3" />
            Sync
            <span className="rounded bg-border2 px-1 py-px text-[8px] font-bold uppercase tracking-wide text-faint">
              soon
            </span>
          </button>
        </>
      )}
    </div>
  );
}
