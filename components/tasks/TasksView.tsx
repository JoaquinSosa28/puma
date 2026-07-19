"use client";

import { useEffect, useMemo, useRef } from "react";
import { useQueryState, parseAsStringLiteral, parseAsString } from "nuqs";
import { ListTodo, X } from "lucide-react";
import type { Task, Tag, Project } from "@/lib/schemas";
import { TaskList } from "@/components/tasks/TaskList";
import { CarryoverSection } from "@/components/tasks/CarryoverSection";
import { TaskDetailPanel } from "@/components/tasks/TaskDetailPanel";
import { iso } from "@/lib/date";
import { cn } from "@/lib/utils";
import { Topbar } from "@/components/shell/Topbar";
import { useTimezone } from "@/components/shell/TimeZoneProvider";

const tabs = ["today", "upcoming", "all"] as const;
const groups = ["none", "tag", "project"] as const;

const TASK_ACCENT = "oklch(0.64 0.18 25)";

type Props = {
  tasks: Task[];
  carryover: Task[];
  tags: Tag[];
  projects: Project[];
  stats: { dayPct: number; habitsLabel: string; topStreak: number };
  birthDate?: string | null;
  lifeSpanYears?: number;
};

type Group = { label: string; count: number; color: string; items: Task[] };

export function TasksView({
  tasks,
  carryover,
  tags,
  projects,
  stats,
  birthDate = null,
  lifeSpanYears,
}: Props) {
  const [tab, setTab] = useQueryState(
    "tab",
    parseAsStringLiteral(tabs).withDefault("today")
  );
  const [group, setGroup] = useQueryState(
    "group",
    parseAsStringLiteral(groups).withDefault("none")
  );
  const [taskId, setTaskId] = useQueryState("task");
  const [projectFilter, setProjectFilter] = useQueryState("project", parseAsString);
  const listRef = useRef<HTMLDivElement>(null);
  const timeZone = useTimezone();
  const td = iso(new Date(), timeZone);

  const selectedTask = useMemo(
    () => (taskId ? tasks.find((t) => t.id === taskId) ?? null : null),
    [tasks, taskId]
  );

  useEffect(() => {
    if (taskId && !selectedTask) setTaskId(null);
  }, [taskId, selectedTask, setTaskId]);

  const filtered = useMemo(() => {
    let items = tasks.filter((t) => {
      const d = (t.due ?? "").slice(0, 10);
      if (tab === "today") return d === td;
      if (tab === "upcoming") return d > td;
      return true;
    });
    if (projectFilter) {
      items = items.filter((t) => t.projectId === projectFilter);
    }
    return items;
  }, [tasks, tab, td, projectFilter]);

  const filteredCarryover = useMemo(() => {
    if (!projectFilter) return carryover;
    return carryover.filter((t) => t.projectId === projectFilter);
  }, [carryover, projectFilter]);

  const todayTasks = useMemo(() => {
    let items = tasks.filter((t) => (t.due ?? "").slice(0, 10) === td);
    if (projectFilter) {
      items = items.filter((t) => t.projectId === projectFilter);
    }
    return items;
  }, [tasks, td, projectFilter]);

  const summary = useMemo(() => {
    const open = filtered.filter((t) => t.status !== "done").length;
    const doing = filtered.filter((t) => t.status === "doing").length;
    const todayDone = todayTasks.filter((t) => t.status === "done").length;
    return { open, doing, todayDone, todayTotal: todayTasks.length };
  }, [filtered, todayTasks]);

  const filteredProject = projectFilter
    ? projects.find((p) => p.id === projectFilter)
    : null;

  const taskGroups = useMemo((): Group[] => {
    if (group === "none") {
      const label =
        filteredProject?.title ??
        (tab === "today" ? "Today" : tab === "upcoming" ? "Upcoming" : "All tasks");
      return [
        {
          label,
          count: filtered.length,
          color: filteredProject?.color ?? TASK_ACCENT,
          items: filtered,
        },
      ];
    }
    if (group === "tag") {
      const result: Group[] = [];
      for (const tg of tags) {
        const items = filtered.filter((t) => t.tagIds.includes(tg.id));
        if (items.length) {
          result.push({
            label: tg.name,
            count: items.length,
            color: tg.color,
            items,
          });
        }
      }
      const untagged = filtered.filter((t) => !t.tagIds.length);
      if (untagged.length) {
        result.push({
          label: "untagged",
          count: untagged.length,
          color: "var(--faint2)",
          items: untagged,
        });
      }
      return result;
    }
    const result: Group[] = [];
    for (const pr of projects) {
      const items = filtered.filter((t) => t.projectId === pr.id);
      if (items.length) {
        result.push({
          label: pr.title,
          count: items.length,
          color: pr.color,
          items,
        });
      }
    }
    const np = filtered.filter((t) => !t.projectId);
    if (np.length) {
      result.push({
        label: "No project",
        count: np.length,
        color: "var(--faint2)",
        items: np,
      });
    }
    return result;
  }, [group, tags, projects, filtered, tab, filteredProject]);

  useEffect(() => {
    if (projectFilter && !filteredProject) setProjectFilter(null);
  }, [projectFilter, filteredProject, setProjectFilter]);

  useEffect(() => {
    if (!taskId || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-task-id="${taskId}"]`);
    if (!el) return;
    const timer = window.setTimeout(() => {
      el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [taskId, taskGroups, tab, group, projectFilter]);

  const emptyCopy =
    tab === "today"
      ? filteredCarryover.length
        ? "Nothing new due today — finish carryover below or check Upcoming."
        : "Nothing due today — capture something above or check Upcoming."
      : tab === "upcoming"
        ? "No upcoming tasks. You're clear ahead."
        : "No tasks yet. Use the capture bar to add one.";

  return (
    <>
      <Topbar
        title="Tasks"
        dayPct={stats.dayPct}
        habitsLabel={stats.habitsLabel}
        topStreak={stats.topStreak}
        birthDate={birthDate}
        lifeSpanYears={lifeSpanYears}
        activeProject={
          filteredProject
            ? {
                title: filteredProject.title,
                color: filteredProject.color,
                onClear: () => setProjectFilter(null),
              }
            : undefined
        }
      />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div
          className="mb-5 flex shrink-0 flex-wrap items-center gap-3 rounded-[13px] border border-border bg-surface px-4 py-3"
          style={{ boxShadow: "2px 2px 0 var(--shadow)" }}
        >
          <SegControl
            value={tab}
            options={[
              ["today", "Today"],
              ["upcoming", "Upcoming"],
              ["all", "All"],
            ]}
            onChange={(v) => setTab(v as typeof tab)}
            accent={TASK_ACCENT}
          />
          <div className="hidden h-5 w-px bg-border sm:block" aria-hidden />
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] font-medium uppercase tracking-widest text-faint2">
              Group
            </span>
            <SegControl
              value={group}
              options={[
                ["none", "None"],
                ["tag", "Tag"],
                ["project", "Project"],
              ]}
              onChange={(v) => setGroup(v as typeof group)}
              compact
            />
            {(group === "project" || filteredProject) && (
              <ProjectFilterControl
                projects={projects}
                value={projectFilter}
                selected={filteredProject}
                onChange={setProjectFilter}
                showPicker={group === "project"}
              />
            )}
          </div>
          <div className="ml-auto flex items-center gap-0.5">
            <TaskStat
              value={
                summary.todayTotal
                  ? `${summary.todayDone}/${summary.todayTotal}`
                  : "0"
              }
              label="TODAY DONE"
              accent={TASK_ACCENT}
            />
            <TaskStat
              value={String(summary.open)}
              label="OPEN"
              className="border-l border-border"
            />
            {summary.doing > 0 && (
              <TaskStat
                value={String(summary.doing)}
                label="IN PROGRESS"
                className="border-l border-border text-primary"
              />
            )}
          </div>
        </div>

        <div
          className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden rounded-[13px] border border-border bg-surface animate-puma-view lg:grid-cols-[minmax(280px,34%)_minmax(480px,1fr)]"
          style={{ boxShadow: "2px 2px 0 var(--shadow)" }}
        >
          <div
            ref={listRef}
            className="min-h-0 overflow-y-auto p-3 lg:border-r lg:border-border2 lg:p-4"
          >
            <div className="flex flex-col gap-4">
              {!filtered.length && !(tab === "today" && filteredCarryover.length) ? (
                <div className="rounded-[13px] border-2 border-dashed border-border bg-surface2/50 px-6 py-12 text-center">
                  <div
                    className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-surface"
                    style={{ color: TASK_ACCENT }}
                  >
                    <ListTodo className="h-5 w-5" />
                  </div>
                  <p className="m-0 text-sm font-semibold text-ink">All clear</p>
                  <p className="mx-auto mt-1.5 max-w-sm text-[13px] text-faint">
                    {emptyCopy}
                  </p>
                </div>
              ) : (
                taskGroups
                  .filter((grp) => grp.items.length > 0)
                  .map((grp) => (
                    <TaskGroupCard
                      key={grp.label}
                      group={grp}
                      tags={tags}
                      selectedId={taskId}
                      onSelect={(id) => setTaskId(taskId === id ? null : id)}
                    />
                  ))
              )}
              {tab === "today" && filteredCarryover.length > 0 && (
                <CarryoverSection
                  tasks={filteredCarryover}
                  tags={tags}
                  variant="page"
                  selectedId={taskId}
                  onSelect={(id) => setTaskId(taskId === id ? null : id)}
                  flat
                />
              )}
            </div>
          </div>

          {/* Desktop: right-hand pane. Phone: full-screen editor overlay. */}
          <div
            className={cn(
              "min-h-0 overflow-hidden bg-surface2/20",
              selectedTask
                ? "fixed inset-0 z-50 bg-background p-0 lg:static lg:z-auto lg:bg-surface2/20"
                : "hidden lg:block"
            )}
          >
            {selectedTask ? (
              <TaskDetailPanel
                task={selectedTask}
                tags={tags}
                projects={projects}
                onClose={() => setTaskId(null)}
                embedded
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center px-8 text-center">
                <p className="m-0 text-sm font-semibold text-ink">Select a task</p>
                <p className="mt-1.5 max-w-[240px] text-[13px] leading-relaxed text-faint">
                  Description, subtasks, priority, and tags live here.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function TaskStat({
  value,
  label,
  className,
  accent,
}: {
  value: string;
  label: string;
  className?: string;
  accent?: string;
}) {
  return (
    <div className={cn("px-3 py-0.5 text-right", className)}>
      <div
        className="text-lg font-extrabold leading-none text-ink"
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </div>
      <div className="mt-0.5 font-mono text-[9px] tracking-wide text-faint">
        {label}
      </div>
    </div>
  );
}

function TaskGroupCard({
  group,
  tags,
  selectedId,
  onSelect,
}: {
  group: Group;
  tags: Tag[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}) {
  const open = group.items.filter((t) => t.status !== "done").length;

  return (
    <section className="overflow-hidden rounded-lg border border-border2 bg-surface">
      <header className="flex items-center gap-2.5 border-b border-border2 bg-surface2/60 px-4 py-3">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ background: group.color }}
        />
        <h3 className="m-0 text-sm font-bold capitalize text-ink">{group.label}</h3>
        <span className="rounded-md border border-border bg-surface px-2 py-0.5 font-mono text-[10px] font-semibold text-faint">
          {group.count}
        </span>
        {open < group.count && (
          <span className="ml-auto font-mono text-[10px] text-faint">
            {open} open
          </span>
        )}
      </header>
      <TaskList
        tasks={group.items}
        tags={tags}
        showDelete
        dueField="full"
        variant="page"
        selectedId={selectedId}
        onSelect={onSelect}
      />
    </section>
  );
}

function ProjectFilterControl({
  projects,
  value,
  selected,
  onChange,
  showPicker,
}: {
  projects: Project[];
  value: string | null;
  selected: Project | null | undefined;
  onChange: (id: string | null) => void;
  showPicker: boolean;
}) {
  if (selected) {
    return (
      <div
        className="flex max-w-[200px] items-center gap-1.5 rounded-lg border-2 px-2 py-1"
        style={{
          borderColor: selected.color,
          background: selected.color.replace(")", " / 0.12)"),
        }}
      >
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
          style={{ background: selected.color }}
        />
        <span className="min-w-0 truncate text-[11px] font-bold text-ink">
          {selected.title}
        </span>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="ml-0.5 flex shrink-0 items-center justify-center rounded text-faint hover:text-ink"
          aria-label="Clear project filter"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    );
  }

  if (!showPicker) return null;

  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      className="max-w-[160px] truncate rounded-lg border border-border bg-surface px-2 py-1 font-mono text-[11px] text-ink outline-none focus:border-faint"
      aria-label="Filter by project"
    >
      <option value="">All projects</option>
      {projects.map((p) => (
        <option key={p.id} value={p.id}>
          {p.title}
        </option>
      ))}
    </select>
  );
}

function SegControl({
  value,
  options,
  onChange,
  accent = "var(--ink)",
  compact,
}: {
  value: string;
  options: [string, string][];
  onChange: (v: string) => void;
  accent?: string;
  compact?: boolean;
}) {
  return (
    <div className="flex gap-1 rounded-lg border border-border bg-surface2 p-1">
      {options.map(([k, label]) => {
        const active = value === k;
        return (
          <button
            key={k}
            type="button"
            onClick={() => onChange(k)}
            className={cn(
              "rounded-md font-semibold transition-all",
              compact ? "px-2.5 py-1 text-[11px]" : "px-3.5 py-1.5 text-[12.5px]",
              active
                ? "border-2 font-bold text-background shadow-[1px_1px_0_var(--shadow)]"
                : "border border-transparent text-muted hover:bg-hover"
            )}
            style={
              active
                ? {
                    background: accent.includes("oklch")
                      ? accent
                      : "var(--ink)",
                    borderColor: accent.includes("oklch") ? accent : "var(--ink)",
                  }
                : undefined
            }
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
