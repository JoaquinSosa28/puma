"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useTheme } from "next-themes";
import type { Settings, Tag } from "@/lib/schemas";
import {
  updateSettingsAction,
  setTheme,
  addTagAction,
  updateUserNameAction,
} from "@/lib/actions/settings";
import { Topbar } from "@/components/shell/Topbar";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState, useEffect, type ReactNode } from "react";
import type { OmniType } from "@/lib/types";
import { LIFE_SPAN_MAX } from "@/lib/date";
import { DEFAULT_HABIT_VISIBILITY, HABIT_VISIBILITY_DEFAULTS } from "@/lib/habit-visibility";
import { SettingsNumberField } from "@/components/settings/SettingsNumberField";
import { DueQuickPick } from "@/components/shell/DueQuickPick";
import { cn } from "@/lib/utils";

type Props = {
  settings: Settings | null;
  userName: string;
  tags: Tag[];
  stats: { dayPct: number; habitsLabel: string; topStreak: number };
};

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-6 border-b border-border/60 py-3 last:border-0 last:pb-0 first:pt-0">
      <div className="min-w-0 flex-1">
        <div className="text-sm text-ink">{label}</div>
        {description ? (
          <p className="mt-0.5 max-w-xl text-[12px] leading-snug text-faint">{description}</p>
        ) : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function SettingsSection({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-[13px] border border-border bg-surface p-5",
        className
      )}
    >
      <h3 className="text-sm font-bold">{title}</h3>
      {description ? (
        <p className="mt-1 mb-3 text-[12px] text-faint">{description}</p>
      ) : (
        <div className="mb-4" />
      )}
      {children}
    </section>
  );
}

export function SettingsView({ settings, userName, tags, stats }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const { setTheme: setLocal } = useTheme();
  const [tagName, setTagName] = useState("");
  const [name, setName] = useState(userName);

  useEffect(() => {
    setName(userName);
  }, [userName]);

  const saveName = () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === userName) {
      setName(userName);
      return;
    }
    startTransition(async () => {
      await updateUserNameAction(trimmed);
      router.refresh();
    });
  };

  const update = (patch: Parameters<typeof updateSettingsAction>[0]) => {
    startTransition(async () => {
      await updateSettingsAction(patch);
      router.refresh();
    });
  };

  const toggleTheme = () => {
    const next = settings?.theme === "dark" ? "light" : "dark";
    setLocal(next);
    startTransition(async () => {
      await setTheme(next);
      router.refresh();
    });
  };

  return (
    <>
      <Topbar
        title="Settings"
        dayPct={stats.dayPct}
        habitsLabel={stats.habitsLabel}
        topStreak={stats.topStreak}
        birthDate={settings?.birthDate ?? null}
        lifeSpanYears={settings?.lifeSpanYears}
      />
      <div className="min-h-0 flex-1 overflow-y-auto pb-6 animate-puma-view">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <SettingsSection title="Profile" className="lg:col-span-2">
            <div className="grid gap-6 lg:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm text-muted">Display name</span>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={saveName}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                  }}
                  placeholder="Your name"
                  maxLength={64}
                />
                <p className="mt-1.5 text-[12px] text-faint">
                  Used in the sidebar and home greeting.
                </p>
              </label>
              <div className="rounded-lg border border-border/70 bg-background/40 p-4">
                <p className="text-[12px] font-medium text-muted">Account</p>
                <p className="mt-2 text-sm text-ink">{userName}</p>
                <p className="mt-1 text-[12px] leading-relaxed text-faint">
                  Local demo profile — name updates apply across the app immediately.
                </p>
              </div>
            </div>
          </SettingsSection>

          <SettingsSection
            title="General"
            description="App-wide preferences for appearance, calendar, and quick capture."
          >
            <SettingRow
              label="Dark mode"
              description="Use the dark color theme across the app."
            >
              <Switch
                checked={settings?.theme === "dark"}
                onCheckedChange={toggleTheme}
              />
            </SettingRow>
            <SettingRow
              label="Week starts on Sunday"
              description="Affects the tasks calendar and week-based views."
            >
              <Switch
                checked={settings?.weekStart === "sun"}
                onCheckedChange={(v) => update({ weekStart: v ? "sun" : "mon" })}
              />
            </SettingRow>
            <SettingRow
              label="Default due today"
              description="New tasks from quick capture default to today."
            >
              <Switch
                checked={settings?.defaultDueToday ?? true}
                onCheckedChange={(v) => update({ defaultDueToday: v })}
              />
            </SettingRow>
            <div className="border-t border-border/60 pt-3">
              <label className="mb-1.5 block text-sm text-ink">Default capture type</label>
              <p className="mb-2 text-[12px] text-faint">
                What the omnibar creates when you don&apos;t pick a type.
              </p>
              <select
                className="w-full max-w-xs rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                value={settings?.defaultCaptureType ?? "task"}
                onChange={(e) =>
                  update({ defaultCaptureType: e.target.value as OmniType })
                }
              >
                <option value="task">Task</option>
                <option value="habit">Habit</option>
                <option value="goal">Goal</option>
                <option value="note">Note</option>
              </select>
            </div>
          </SettingsSection>

          <SettingsSection
            title="Life calendar"
            description="Birth date, span, and how the life grid is displayed."
          >
            <SettingRow
              label="Full view"
              description="Fit your entire life grid in the viewport with a simplified two-color layout."
            >
              <Switch
                checked={settings?.lifeCalendarFullView ?? false}
                onCheckedChange={(v) => update({ lifeCalendarFullView: v })}
              />
            </SettingRow>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm text-muted">Birth date</span>
                <DueQuickPick
                  mode="birth"
                  value={settings?.birthDate ?? null}
                  onChange={(next) => {
                    if (next) update({ birthDate: next });
                  }}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm text-muted">
                  Life span (years, max {LIFE_SPAN_MAX})
                </span>
                <input
                  type="number"
                  min={1}
                  max={LIFE_SPAN_MAX}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                  value={settings?.lifeSpanYears ?? LIFE_SPAN_MAX}
                  onChange={(e) =>
                    update({
                      lifeSpanYears: Math.min(
                        LIFE_SPAN_MAX,
                        Math.max(1, Number(e.target.value) || LIFE_SPAN_MAX)
                      ),
                    })
                  }
                />
              </label>
            </div>
          </SettingsSection>

          <SettingsSection
            title="Habits"
            description="How many squares each habit heatmap shows, by cadence."
          >
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <span className="mb-1 block text-sm text-muted">Daily habits</span>
                <SettingsNumberField
                  value={settings?.habitVisibleDays ?? DEFAULT_HABIT_VISIBILITY.dailyDays}
                  suffix="days"
                  hint={`Default ${HABIT_VISIBILITY_DEFAULTS.dailyDays.default} days`}
                  onSave={(habitVisibleDays) => update({ habitVisibleDays })}
                />
              </div>
              <div>
                <span className="mb-1 block text-sm text-muted">Weekly habits</span>
                <SettingsNumberField
                  value={settings?.habitVisibleWeeks ?? DEFAULT_HABIT_VISIBILITY.weeklyWeeks}
                  suffix="weeks"
                  hint={`Default ${HABIT_VISIBILITY_DEFAULTS.weeklyWeeks.default} weeks (2 months)`}
                  onSave={(habitVisibleWeeks) => update({ habitVisibleWeeks })}
                />
              </div>
              <div>
                <span className="mb-1 block text-sm text-muted">Monthly habits</span>
                <SettingsNumberField
                  value={settings?.habitVisibleMonths ?? DEFAULT_HABIT_VISIBILITY.monthlyMonths}
                  suffix="months"
                  hint={`Default ${HABIT_VISIBILITY_DEFAULTS.monthlyMonths.default} months`}
                  onSave={(habitVisibleMonths) => update({ habitVisibleMonths })}
                />
              </div>
            </div>
          </SettingsSection>

          <SettingsSection title="Tags" className="lg:col-span-2">
            <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {tags.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center gap-2 rounded-lg border border-border/70 bg-background/40 px-3 py-2.5 text-sm"
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: t.color }}
                  />
                  <span className="min-w-0 truncate">{t.name}</span>
                  {t.isDefault ? (
                    <span className="ml-auto shrink-0 font-mono text-[10px] text-faint">
                      default
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
            <div className="flex max-w-xl gap-2">
              <Input
                value={tagName}
                onChange={(e) => setTagName(e.target.value)}
                placeholder="New tag name"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && tagName.trim()) {
                    startTransition(async () => {
                      await addTagAction(tagName);
                      setTagName("");
                      router.refresh();
                    });
                  }
                }}
              />
              <Button
                onClick={() =>
                  startTransition(async () => {
                    await addTagAction(tagName);
                    setTagName("");
                    router.refresh();
                  })
                }
              >
                Add
              </Button>
            </div>
          </SettingsSection>
        </div>
      </div>
    </>
  );
}
