"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useQueryState, parseAsStringLiteral } from "nuqs";
import {
  LIFE_AREA_COOKIE,
  parseLifeView,
  hrefWithLife,
  type LifeView,
} from "@/lib/life-area";
import { formatTimeHM, iso, parseTimeToMinutes } from "@/lib/date";
import { useTimezone } from "@/components/shell/TimeZoneProvider";
import { useSyncedDraft } from "@/lib/use-synced-draft";
import { updateSettingsAction } from "@/lib/actions/settings";
import { cn } from "@/lib/utils";

const options = ["both", "personal", "work"] as const;

const labels: Record<(typeof options)[number], string> = {
  both: "Both",
  personal: "Personal",
  work: "Work",
};

export type LifeAutoConfig = {
  enabled: boolean;
  workStart: string; // "HH:MM"
  workEnd: string;
  workDays: number[]; // JS getDay(): 0=Sun … 6=Sat
  overrideMins: number;
};

/** Manual-override marker: while now < until, the auto-switcher stays hands-off. */
const OVERRIDE_KEY = "puma-life-override";

function readOverrideUntil(): number | null {
  try {
    const raw = window.localStorage.getItem(OVERRIDE_KEY);
    if (!raw) return null;
    const until = Number(raw);
    return Number.isFinite(until) ? until : null;
  } catch {
    return null;
  }
}

function writeOverrideUntil(until: number | null) {
  try {
    if (until === null) window.localStorage.removeItem(OVERRIDE_KEY);
    else window.localStorage.setItem(OVERRIDE_KEY, String(until));
  } catch {
    // localStorage unavailable (private mode) — auto-switch just won't hold overrides.
  }
}

/** Which mode the clock says we should be in right now. */
function scheduledMode(cfg: LifeAutoConfig, timeZone: string): LifeView {
  const now = new Date();
  const dow = new Date(iso(now, timeZone) + "T00:00").getDay();
  if (!cfg.workDays.includes(dow)) return "personal";
  const mins = parseTimeToMinutes(formatTimeHM(now, timeZone));
  const start = parseTimeToMinutes(cfg.workStart);
  const end = parseTimeToMinutes(cfg.workEnd);
  const inWindow =
    start <= end ? mins >= start && mins < end : mins >= start || mins < end;
  return inWindow ? "work" : "personal";
}

function readLifeCookie(): LifeView {
  if (typeof document === "undefined") return "both";
  const match = document.cookie.match(/(?:^|;\s*)puma-life=([^;]*)/);
  return parseLifeView(match?.[1]);
}

export function LifeAreaToggle({
  className,
  auto,
}: {
  className?: string;
  auto?: LifeAutoConfig;
}) {
  const router = useRouter();
  const timeZone = useTimezone();
  const syncedFromCookie = useRef(false);
  const [life, setLife] = useQueryState(
    "life",
    parseAsStringLiteral(options).withDefault("both")
  );
  // Ticks every 30s so the schedule check and countdown label stay current.
  // Also gates the indicator to post-mount (its text depends on the clock, so
  // rendering it during SSR would hydrate-mismatch).
  const [now, setNow] = useState<number | null>(null);

  // Keep URL in sync with saved preference when landing without ?life=
  useEffect(() => {
    if (syncedFromCookie.current) return;
    syncedFromCookie.current = true;
    const params = new URLSearchParams(window.location.search);
    if (params.has("life")) return;
    const stored = readLifeCookie();
    if (stored !== life) {
      void setLife(stored);
    }
  }, [life, setLife]);

  const apply = (next: LifeView) => {
    document.cookie = `${LIFE_AREA_COOKIE}=${next}; path=/; max-age=31536000; SameSite=Lax`;
    void setLife(next).then(() => router.refresh());
  };

  // The auto-switcher: follow the work-hours schedule unless a manual override
  // is still fresh. Runs on mount and every 30s.
  const enabled = auto?.enabled ?? false;
  useEffect(() => {
    if (!enabled || !auto) return;
    const tick = () => {
      setNow(Date.now());
      const until = readOverrideUntil();
      if (until !== null) {
        if (Date.now() < until) return; // user's pick still holds
        writeOverrideUntil(null);
      }
      const target = scheduledMode(auto, timeZone);
      if (readLifeCookie() !== target) apply(target);
    };
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, auto?.workStart, auto?.workEnd, auto?.overrideMins, auto?.workDays.join(","), timeZone]);

  const select = (next: LifeView) => {
    if (next === life) return;
    if (enabled && auto) {
      // Picking what the schedule wants anyway = back on autopilot;
      // anything else holds for the configured override window.
      if (next === scheduledMode(auto, timeZone)) writeOverrideUntil(null);
      else writeOverrideUntil(Date.now() + auto.overrideMins * 60_000);
      setNow(Date.now());
    }
    apply(next);
  };

  // Indicator label (client-only): "auto" when following the schedule, or the
  // countdown until the schedule takes back over. Gated to post-mount since
  // it depends on the clock (SSR would hydrate-mismatch otherwise).
  let indicator: string | null = null;
  if (enabled && now !== null) {
    const until = readOverrideUntil();
    if (until !== null && until > now) {
      indicator = `auto in ${Math.max(1, Math.ceil((until - now) / 60_000))}m`;
    } else {
      indicator = "auto";
    }
  }

  const [savingAutoSwitch, startAutoSwitchTransition] = useTransition();
  const setAutoSwitch = (nextEnabled: boolean) => {
    if (nextEnabled === enabled) return;
    startAutoSwitchTransition(async () => {
      await updateSettingsAction({ lifeAutoSwitch: nextEnabled });
      router.refresh();
    });
  };

  // Override-window minutes editor. Keyed on a constant so a local edit isn't
  // blown away by a router.refresh() before the new value round-trips back.
  const [minsDraft, setMinsDraft] = useSyncedDraft(
    String(auto?.overrideMins ?? 60),
    "life-auto-override-mins"
  );
  const [, startMinsTransition] = useTransition();
  const commitMins = () => {
    const n = Math.round(Number(minsDraft));
    const fallback = String(auto?.overrideMins ?? 60);
    if (!Number.isFinite(n) || n < 5 || n > 720) {
      setMinsDraft(fallback);
      return;
    }
    setMinsDraft(String(n));
    if (n === auto?.overrideMins) return;
    startMinsTransition(async () => {
      await updateSettingsAction({ lifeAutoOverrideMins: n });
      router.refresh();
    });
  };

  return (
    <div className={cn("mb-3", className)}>
      <div className="grid grid-cols-3 gap-1 rounded-lg border border-border bg-surface p-1">
        {options.map((key) => {
          const active = life === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => select(key)}
              className={cn(
                "rounded-md px-1.5 py-2 text-[11px] font-semibold transition-colors",
                active
                  ? key === "work"
                    ? "bg-[oklch(0.58_0.14_245/0.14)] text-[oklch(0.44_0.14_245)]"
                    : key === "personal"
                      ? "bg-[oklch(0.58_0.17_300/0.14)] text-[oklch(0.46_0.17_300)]"
                      : "bg-hover text-ink"
                  : "text-muted hover:bg-hover"
              )}
            >
              {labels[key]}
            </button>
          );
        })}
      </div>
      {auto && (
        <div className="mt-1 flex items-center justify-between gap-1.5 px-0.5">
          <div
            className="flex items-center gap-0.5 rounded-md border border-border p-0.5"
            title="Manual: Personal/Work/Both stays where you set it. Auto: it follows your work-hours schedule (Settings → Life areas)."
          >
            {(["manual", "auto"] as const).map((mode) => {
              const active = mode === "auto" ? enabled : !enabled;
              return (
                <button
                  key={mode}
                  type="button"
                  disabled={savingAutoSwitch}
                  onClick={() => setAutoSwitch(mode === "auto")}
                  className={cn(
                    "rounded px-1.5 py-0.5 font-mono text-[9px] font-semibold lowercase tracking-wide transition-colors disabled:opacity-50",
                    active ? "bg-hover text-ink" : "text-faint2 hover:text-muted"
                  )}
                >
                  {mode}
                </button>
              );
            })}
          </div>
          {enabled && (
            <div className="flex items-center gap-1.5 font-mono text-[9px] text-faint2">
              {indicator && (
                <span title="Auto life-area switch is on (Settings → Life areas)">
                  {indicator}
                </span>
              )}
              <label
                className="flex items-center gap-0.5"
                title="Minutes a manual pick holds before auto takes back over (5–720)"
              >
                <input
                  type="number"
                  min={5}
                  max={720}
                  value={minsDraft}
                  onChange={(e) => setMinsDraft(e.target.value)}
                  onBlur={commitMins}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                  }}
                  className="w-8 border-none bg-transparent text-right font-mono text-[9px] text-faint2 outline-none focus:text-ink"
                />
                m
              </label>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function useLifeView() {
  return useQueryState(
    "life",
    parseAsStringLiteral(options).withDefault("both")
  );
}

/** @deprecated use useLifeView */
export const useLifeArea = useLifeView;

export { hrefWithLife as hrefWithAppParams };
