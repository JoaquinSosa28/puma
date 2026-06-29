"use client";

import { useEffect, useOptimistic, useTransition } from "react";
import { useQueryState } from "nuqs";
import { Check } from "lucide-react";
import type { Goal, Habit, HabitEntry } from "@/lib/schemas";
import { iso, streakOf, bestStreak, type WeekStart } from "@/lib/date";
import {
  toggleHabitDate,
  archiveHabit,
  updateHabitFrequencyAction,
} from "@/lib/actions/habits";
import { attachHabitToGoal, detachHabitFromGoal } from "@/lib/actions/links";
import { Topbar } from "@/components/shell/Topbar";
import { GoalMultiLinkField } from "@/components/links/GoalLinkField";
import { HabitHeatStrip } from "@/components/habits/HabitHeatStrip";
import {
  habitFrequencyLabel,
  normalizeHabitFrequency,
  type HabitFrequencyType,
  type HabitVisibilitySettings,
} from "@/lib/habit-visibility";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useTimezone } from "@/components/shell/TimeZoneProvider";

type Props = {
  habits: Habit[];
  habitEntries: HabitEntry[];
  goals: Goal[];
  stats: { dayPct: number; habitsLabel: string; topStreak: number };
  habitVisibility: HabitVisibilitySettings;
  weekStart: WeekStart;
  birthDate?: string | null;
  lifeSpanYears?: number;
};

export function HabitsView({
  habits,
  habitEntries,
  goals,
  stats,
  habitVisibility,
  weekStart,
  birthDate = null,
  lifeSpanYears,
}: Props) {
  const [, startTransition] = useTransition();
  const [habitId] = useQueryState("habit");
  const timeZone = useTimezone();
  const td = iso(new Date(), timeZone);

  // Optimistic entries: the checkbox / heat cell / streaks update instantly,
  // then reconcile when the server action + revalidation returns.
  const [optimisticEntries, applyToggle] = useOptimistic(
    habitEntries,
    (state: HabitEntry[], toggle: { habitId: string; date: string }) => {
      const exists = state.some(
        (e) => e.habitId === toggle.habitId && e.date === toggle.date
      );
      return exists
        ? state.filter(
            (e) => !(e.habitId === toggle.habitId && e.date === toggle.date)
          )
        : [
            ...state,
            {
              id: `optimistic:${toggle.habitId}:${toggle.date}`,
              habitId: toggle.habitId,
              date: toggle.date,
              done: true,
            },
          ];
    }
  );

  const entriesFor = (id: string) =>
    new Set(
      optimisticEntries.filter((e) => e.habitId === id).map((e) => e.date)
    );

  const toggleEntry = (id: string, date: string) =>
    startTransition(async () => {
      applyToggle({ habitId: id, date });
      await toggleHabitDate(id, date);
    });

  useEffect(() => {
    if (!habitId) return;
    document
      .getElementById(`habit-${habitId}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [habitId, habits]);

  return (
    <>
      <Topbar
        title="Habits"
        dayPct={stats.dayPct}
        habitsLabel={stats.habitsLabel}
        topStreak={stats.topStreak}
        birthDate={birthDate}
        lifeSpanYears={lifeSpanYears}
      />
      <div className="min-h-0 flex-1 overflow-y-auto pb-6 animate-puma-view">
        <div className="mb-4 flex items-center gap-3">
          <span className="font-mono text-[11px] text-faint">
            {stats.habitsLabel} done today · best streak {stats.topStreak}🔥
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {habits.map((h) => {
            const set = entriesFor(h.id);
            const doneToday = set.has(td);
            const frequency = normalizeHabitFrequency(h.frequency.type);
            const linkedGoals = goals.filter((g) => h.goalIds.includes(g.id));
            const availableGoals = goals.filter((g) => !h.goalIds.includes(g.id));
            return (
              <div
                key={h.id}
                id={`habit-${h.id}`}
                className={cn(
                  "flex min-h-[168px] flex-col gap-3 rounded-[13px] border border-border bg-surface p-4 hover:border-faint2",
                  h.archived && "opacity-45",
                  habitId === h.id && "ring-2 ring-habits/35"
                )}
              >
                <div className="flex items-start gap-2.5">
                  <button
                    type="button"
                    onClick={() => toggleEntry(h.id, td)}
                    className={cn(
                      "mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md border-2",
                      doneToday ? "border-none bg-habits" : "border-border"
                    )}
                  >
                    {doneToday && (
                      <Check className="h-[13px] w-[13px] text-white" strokeWidth={3.2} />
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1 truncate text-[14.5px] font-semibold">
                        {h.name}
                      </div>
                      <select
                        className="shrink-0 rounded-md border border-border bg-surface px-2 py-1 font-mono text-[10px] text-muted outline-none focus:border-faint"
                        value={frequency}
                        onChange={(e) =>
                          startTransition(async () => {
                            await updateHabitFrequencyAction(h.id, {
                              type: e.target.value as HabitFrequencyType,
                            });
                          })
                        }
                      >
                        <option value="daily">{habitFrequencyLabel("daily")}</option>
                        <option value="weekly">{habitFrequencyLabel("weekly")}</option>
                        <option value="monthly">{habitFrequencyLabel("monthly")}</option>
                      </select>
                    </div>
                    <div className="mt-2">
                      <GoalMultiLinkField
                      label="Goals"
                      items={linkedGoals.map((g) => ({
                        id: g.id,
                        title: g.title,
                      }))}
                      available={availableGoals.map((g) => ({
                        id: g.id,
                        title: g.title,
                      }))}
                      dotShape="diamond"
                      onAttach={(goalId) =>
                        startTransition(async () => {
                          await attachHabitToGoal(h.id, goalId);
                        })
                      }
                      onDetach={(goalId) =>
                        startTransition(async () => {
                          await detachHabitFromGoal(h.id, goalId);
                        })
                      }
                    />
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-center gap-1">
                    <Switch
                      checked={!h.archived}
                      onCheckedChange={(active) => {
                        if (active === !h.archived) return;
                        startTransition(async () => {
                          await archiveHabit(h.id);
                        });
                      }}
                      aria-label={h.archived ? "Enable habit" : "Disable habit"}
                    />
                    <span className="font-mono text-[9px] text-faint">
                      {h.archived ? "off" : "on"}
                    </span>
                  </div>
                </div>

                <HabitHeatStrip
                  habit={h}
                  entries={set}
                  visibility={habitVisibility}
                  weekStart={weekStart}
                  onToggleDate={(ds) => toggleEntry(h.id, ds)}
                  className="min-h-[52px] flex-1 content-start"
                />

                <div className="flex items-center gap-5 border-t border-border2 pt-2.5">
                  <div className="text-center">
                    <div className="text-lg font-extrabold text-habits">
                      {streakOf(set, td, timeZone)}
                    </div>
                    <div className="font-mono text-[9px] text-faint">STREAK</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-extrabold">{bestStreak(set)}</div>
                    <div className="font-mono text-[9px] text-faint">BEST</div>
                  </div>
                  <span className="ml-auto font-mono text-[9px] uppercase tracking-wide text-faint">
                    {habitFrequencyLabel(frequency)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
