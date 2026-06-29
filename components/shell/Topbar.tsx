"use client";

import Link from "next/link";
import { greeting } from "@/lib/date";
import { formatTopbarDateLine } from "@/lib/date-context";
import { DEFAULT_USER_NAME } from "@/lib/user-display";
import { ActiveTaskTimer } from "@/components/shell/ActiveTaskTimer";
import { TopbarProjectPill } from "@/components/shell/TopbarProjectPill";
import { useTimezone } from "@/components/shell/TimeZoneProvider";
import { cn } from "@/lib/utils";

type ActiveProject = {
  title: string;
  color: string;
  onClear?: () => void;
};

type Props = {
  title: string;
  dayPct: number;
  habitsLabel: string;
  topStreak: number;
  showGreeting?: boolean;
  userName?: string;
  activeProject?: ActiveProject;
  statLinks?: {
    dayDone?: string;
    habits?: string;
    streak?: string;
    calendar?: string;
  };
  birthDate?: string | null;
  lifeSpanYears?: number;
};

export function Topbar({
  title,
  dayPct,
  habitsLabel,
  topStreak,
  showGreeting = false,
  userName = DEFAULT_USER_NAME,
  activeProject,
  statLinks,
  birthDate = null,
  lifeSpanYears,
}: Props) {
  const timeZone = useTimezone();
  const now = new Date();
  const dateLine = formatTopbarDateLine(now, {
    birthDate,
    lifeSpanYears,
    timeZone,
  });
  return (
    <div className="mb-4 flex shrink-0 items-end justify-between">
      <div>
        {statLinks?.calendar ? (
          <Link
            href={statLinks.calendar}
            className="mb-1 inline-block max-w-[min(100%,52rem)] font-mono text-[11px] leading-relaxed tracking-wide text-faint transition-colors hover:text-muted"
          >
            {dateLine}
          </Link>
        ) : (
          <div className="mb-1 max-w-[min(100%,52rem)] font-mono text-[11px] leading-relaxed tracking-wide text-faint">
            {dateLine}
          </div>
        )}
        <div className="flex h-9 min-w-0 items-center gap-3">
          <h1 className="m-0 shrink-0 text-[26px] font-extrabold tracking-tight text-ink">
            {showGreeting ? greeting(userName, timeZone) : title}
          </h1>
          {activeProject ? (
            <TopbarProjectPill
              title={activeProject.title}
              color={activeProject.color}
              onClear={activeProject.onClear}
            />
          ) : null}
          <ActiveTaskTimer className="min-w-0 flex-1" />
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Stat
          value={`${dayPct}`}
          suffix="%"
          label="DAY DONE"
          href={statLinks?.dayDone}
        />
        <Stat
          value={habitsLabel}
          label="HABITS"
          className="border-l border-border text-habits"
          href={statLinks?.habits}
        />
        <Stat
          value={`${topStreak}🔥`}
          label="STREAK"
          className="border-l border-border"
          href={statLinks?.streak}
        />
      </div>
    </div>
  );
}

function Stat({
  value,
  suffix,
  label,
  className = "",
  href,
}: {
  value: string;
  suffix?: string;
  label: string;
  className?: string;
  href?: string;
}) {
  const inner = (
    <>
      <div className="text-xl font-extrabold text-ink">
        {value}
        {suffix && <span className="text-xs text-faint">{suffix}</span>}
      </div>
      <div className="font-mono text-[10px] text-faint">{label}</div>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={cn(
          "rounded-lg px-4 py-1 text-right transition-colors hover:bg-hover",
          className
        )}
      >
        {inner}
      </Link>
    );
  }

  return <div className={cn("px-4 text-right", className)}>{inner}</div>;
}
