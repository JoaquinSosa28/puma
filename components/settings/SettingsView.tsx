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
  setAiApiKeyAction,
  clearAiApiKeyAction,
} from "@/lib/actions/settings";
import { deleteTagAction, updateTagAction } from "@/lib/actions/tags";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { toast } from "sonner";
import { Trash2, KeyRound, Check } from "lucide-react";
import { TAG_PALETTE } from "@/lib/types";
import { Topbar } from "@/components/shell/Topbar";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState, useEffect, type ReactNode } from "react";
import type { OmniType } from "@/lib/types";
import { LIFE_SPAN_MAX } from "@/lib/date";
import { DEFAULT_HABIT_VISIBILITY, HABIT_VISIBILITY_DEFAULTS } from "@/lib/habit-visibility";
import { SettingsNumberField } from "@/components/settings/SettingsNumberField";
import { TimezoneSelect } from "@/components/settings/TimezoneSelect";
import { SubscriptionCard } from "@/components/settings/SubscriptionCard";
import { DueQuickPick } from "@/components/shell/DueQuickPick";
import { cn } from "@/lib/utils";

type Props = {
  settings: Settings | null;
  userName: string;
  userEmail: string | null;
  authEnabled: boolean;
  // Hosted deployments with an active subscription show the billing card.
  showSubscription?: boolean;
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

export function SettingsView({
  settings,
  userName,
  userEmail,
  authEnabled,
  showSubscription = false,
  tags,
  stats,
}: Props) {
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
      <div className="min-h-0 flex-1 overflow-y-auto pb-6 max-lg:pb-28 animate-puma-view">
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
              <div className="flex flex-col rounded-lg border border-border/70 bg-background/40 p-4">
                <p className="text-[12px] font-medium text-muted">Account</p>
                {authEnabled ? (
                  <>
                    <p className="mt-2 truncate text-sm text-ink">
                      {userEmail ?? userName}
                    </p>
                    <p className="mt-1 text-[12px] leading-relaxed text-faint">
                      Signed in. Ending your session returns you to the login screen.
                    </p>
                    <SignOutButton variant="button" className="mt-3 w-full" />
                  </>
                ) : (
                  <>
                    <p className="mt-2 text-sm text-ink">{userName}</p>
                    <p className="mt-1 text-[12px] leading-relaxed text-faint">
                      Local demo profile — name updates apply across the app immediately.
                    </p>
                  </>
                )}
              </div>
            </div>
          </SettingsSection>

          <SettingsSection
            title="Assistant"
            description="PUMA's Plan and Ask features call Claude with your own Anthropic API key. It's stored encrypted and used only for your requests."
            className="lg:col-span-2"
          >
            <ApiKeyField last4={settings?.aiApiKeyLast4 ?? null} />
          </SettingsSection>

          {showSubscription && (
            <SettingsSection
              title="Subscription"
              description="Your hosted PUMA plan — payments are handled by the billing provider; this app never sees your card."
              className="lg:col-span-2"
            >
              <SubscriptionCard />
            </SettingsSection>
          )}

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
            <div className="border-t border-border/60 py-3">
              <label className="mb-1.5 block text-sm text-ink">Timezone</label>
              <p className="mb-2 text-[12px] text-faint">
                Used for today, due dates, habits, calendar, and greetings across the app.
              </p>
              <TimezoneSelect
                value={settings?.timezone ?? "UTC"}
                onChange={(timezone) => update({ timezone })}
              />
            </div>
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
            title="Life areas"
            description="Automatically switch the sidebar Personal/Work toggle with your working hours."
          >
            <SettingRow
              label="Auto switch"
              description="Work during working hours, Personal outside them. A manual pick holds for the override window below."
            >
              <Switch
                checked={settings?.lifeAutoSwitch ?? false}
                onCheckedChange={(v) => update({ lifeAutoSwitch: v })}
              />
            </SettingRow>
            <div className="grid gap-4 border-t border-border/60 pt-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm text-muted">Work starts</span>
                <input
                  type="time"
                  value={settings?.workStart ?? "09:00"}
                  onChange={(e) => {
                    if (e.target.value) update({ workStart: e.target.value });
                  }}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 font-mono text-sm"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm text-muted">Work ends</span>
                <input
                  type="time"
                  value={settings?.workEnd ?? "18:00"}
                  onChange={(e) => {
                    if (e.target.value) update({ workEnd: e.target.value });
                  }}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 font-mono text-sm"
                />
              </label>
            </div>
            <div className="mt-4">
              <span className="mb-1.5 block text-sm text-muted">Work days</span>
              <WorkDaysPicker
                value={settings?.workDays ?? [1, 2, 3, 4, 5]}
                onChange={(workDays) => update({ workDays })}
              />
            </div>
            <div className="mt-4 max-w-[220px]">
              <span className="mb-1 block text-sm text-muted">
                Manual override lasts
              </span>
              <SettingsNumberField
                value={settings?.lifeAutoOverrideMins ?? 60}
                suffix="min"
                hint="Then the schedule takes back over"
                onSave={(lifeAutoOverrideMins) => update({ lifeAutoOverrideMins })}
              />
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
            <p className="mb-3 text-[12px] text-faint">
              Click the dot to change a tag&apos;s color, click the name to rename.
            </p>
            <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {tags.map((t) => (
                <TagRow key={t.id} tag={t} />
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

/** Mon-first weekday toggles for the auto-switch schedule (values = JS getDay). */
const WORKDAY_ORDER: { day: number; label: string }[] = [
  { day: 1, label: "M" },
  { day: 2, label: "T" },
  { day: 3, label: "W" },
  { day: 4, label: "T" },
  { day: 5, label: "F" },
  { day: 6, label: "S" },
  { day: 0, label: "S" },
];

function WorkDaysPicker({
  value,
  onChange,
}: {
  value: number[];
  onChange: (days: number[]) => void;
}) {
  const toggle = (day: number) => {
    const next = value.includes(day)
      ? value.filter((d) => d !== day)
      : [...value, day];
    onChange(next.sort((a, b) => a - b));
  };
  return (
    <div className="flex gap-1">
      {WORKDAY_ORDER.map(({ day, label }, i) => {
        const active = value.includes(day);
        return (
          <button
            key={`${day}-${i}`}
            type="button"
            onClick={() => toggle(day)}
            aria-pressed={active}
            className={cn(
              "h-8 w-8 rounded-lg border font-mono text-[11px] font-bold transition-colors",
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
  );
}

/** Paste / replace / remove the user's own Anthropic API key. The raw key is
 *  write-only from the client's perspective — we only ever receive back the
 *  last 4 chars of whatever is stored. */
function ApiKeyField({ last4 }: { last4: string | null }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [, startTransition] = useTransition();
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);

  const configured = last4 !== null;

  const save = () => {
    const key = draft.trim();
    if (!key) return;
    startTransition(async () => {
      const res = await setAiApiKeyAction(key);
      if (!res.ok) {
        toast.error(res.error ?? "Could not save key");
        return;
      }
      toast.success("API key saved");
      setDraft("");
      setEditing(false);
      router.refresh();
    });
  };

  const remove = async () => {
    const ok = await confirm({
      title: "Remove API key?",
      description: "Plan and Ask will stop working until you add a key again.",
      confirmLabel: "Remove",
      destructive: true,
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await clearAiApiKeyAction();
      if (!res.ok) {
        toast.error(res.error ?? "Could not remove key");
        return;
      }
      toast.success("API key removed");
      setDraft("");
      setEditing(false);
      router.refresh();
    });
  };

  // Configured and not actively replacing → show the masked status row.
  if (configured && !editing) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3 rounded-lg border border-border/70 bg-background/40 px-3 py-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-habits/10 text-habits">
            <Check className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-ink">Key configured</p>
            <p className="font-mono text-[12px] text-faint">sk-ant-••••{last4}</p>
          </div>
          <Button variant="outline" onClick={() => setEditing(true)}>
            Replace
          </Button>
          <button
            type="button"
            onClick={remove}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-faint2 transition-colors hover:bg-tasks/10 hover:text-tasks"
            aria-label="Remove API key"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
        <p className="text-[12px] text-faint">
          Get a key from the{" "}
          <a
            href="https://console.anthropic.com/settings/keys"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-ink"
          >
            Anthropic Console
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex max-w-xl gap-2">
        <div className="relative flex-1">
          <KeyRound className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint2" />
          <Input
            type="password"
            autoComplete="off"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && draft.trim()) save();
            }}
            placeholder="sk-ant-…"
            className="pl-8 font-mono"
          />
        </div>
        <Button onClick={save} disabled={!draft.trim()}>
          Save
        </Button>
        {configured && editing ? (
          <Button
            variant="outline"
            onClick={() => {
              setEditing(false);
              setDraft("");
            }}
          >
            Cancel
          </Button>
        ) : null}
      </div>
      <p className="text-[12px] text-faint">
        Paste your Anthropic key (starts with <code>sk-ant-</code>). Get one from the{" "}
        <a
          href="https://console.anthropic.com/settings/keys"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-ink"
        >
          Anthropic Console
        </a>
        . It&apos;s encrypted before storage and never shown again.
      </p>
    </div>
  );
}

/** Editable tag row: cycle color via the dot, rename inline, delete (non-default). */
function TagRow({ tag }: { tag: Tag }) {
  const [, startTransition] = useTransition();
  const confirm = useConfirm();
  const [draft, setDraft] = useState(tag.name);

  useEffect(() => setDraft(tag.name), [tag.name]);

  const cycleColor = () => {
    const idx = TAG_PALETTE.indexOf(tag.color as (typeof TAG_PALETTE)[number]);
    const next = TAG_PALETTE[(idx + 1) % TAG_PALETTE.length];
    startTransition(async () => {
      const res = await updateTagAction({ id: tag.id, color: next });
      if (!res.ok) toast.error(res.error ?? "Could not update color");
    });
  };

  const saveName = () => {
    const next = draft.trim().toLowerCase();
    if (!next || next === tag.name) {
      setDraft(tag.name);
      return;
    }
    startTransition(async () => {
      const res = await updateTagAction({ id: tag.id, name: next });
      if (!res.ok) {
        toast.error(res.error ?? "Could not rename tag");
        setDraft(tag.name);
      }
    });
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: `Delete tag "${tag.name}"?`,
      description: "It will be removed from every task and note that uses it.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await deleteTagAction(tag.id);
      if (!res.ok) toast.error(res.error ?? "Could not delete tag");
      else toast.success("Tag deleted");
    });
  };

  return (
    <div className="group flex items-center gap-2 rounded-lg border border-border/70 bg-background/40 px-3 py-2 text-sm">
      <button
        type="button"
        onClick={cycleColor}
        className="h-3.5 w-3.5 shrink-0 rounded-full ring-offset-1 transition-transform hover:scale-125 focus-visible:ring-2 focus-visible:ring-faint"
        style={{ background: tag.color }}
        aria-label={`Change color of ${tag.name}`}
        title="Click to change color"
      />
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={saveName}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            setDraft(tag.name);
            e.currentTarget.blur();
          }
        }}
        maxLength={40}
        aria-label={`Rename tag ${tag.name}`}
        className="min-w-0 flex-1 truncate rounded border border-transparent bg-transparent px-1 py-0.5 lowercase outline-none transition-colors hover:border-border focus:border-faint"
      />
      {tag.isDefault ? (
        <span className="ml-auto shrink-0 font-mono text-[10px] text-faint">
          default
        </span>
      ) : (
        <button
          type="button"
          onClick={handleDelete}
          className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-faint2 opacity-0 transition-all hover:bg-tasks/10 hover:text-tasks group-hover:opacity-100 focus-visible:opacity-100"
          aria-label={`Delete tag ${tag.name}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
