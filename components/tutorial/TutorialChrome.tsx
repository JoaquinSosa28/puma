"use client";

// The furniture around the stage: the mission banner up top and the checklist
// down the side. Both exist so the tour never leaves you wondering what it
// wants or how much is left — the two things that make a walkthrough feel
// like a hostage situation.
import { Check } from "lucide-react";
import type { Beat } from "@/lib/tutorial";
import { cn } from "@/lib/utils";

export function MissionBanner({
  beat,
  index,
  total,
  cleared,
}: {
  beat: Beat;
  index: number;
  total: number;
  cleared: boolean;
}) {
  const isMission = beat.kind === "do";
  return (
    <div key={beat.id} className="tutorial-in mx-auto w-full max-w-[620px] text-center">
      <div className="mb-2 flex items-center justify-center gap-2">
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 font-mono text-[9.5px] font-bold uppercase tracking-[0.16em]",
            isMission
              ? "bg-primary text-background"
              : "border border-white/25 text-white/60"
          )}
        >
          {isMission ? `Mission ${index + 1}/${total}` : "Watch"}
        </span>
        {isMission && !cleared && (
          <span className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-white/40">
            your turn
          </span>
        )}
      </div>

      <p className="m-0 text-[20px] font-extrabold leading-tight tracking-tight text-white sm:text-[25px]">
        {beat.caption}
      </p>

      {/* The instruction is replaced by the payoff once the mission lands, so
          the banner is never telling you to do something you've just done. */}
      <p
        className={cn(
          "m-0 mt-2 text-[13.5px] leading-relaxed transition-colors",
          cleared ? "font-semibold text-habits" : "text-white/65"
        )}
      >
        {cleared && beat.done ? `✓ ${beat.done}` : beat.sub}
      </p>
    </div>
  );
}

export function TutorialChecklist({
  beats,
  index,
  className,
}: {
  beats: Beat[];
  index: number;
  className?: string;
}) {
  return (
    <ol
      className={cn(
        "m-0 flex list-none flex-col gap-1 rounded-xl border border-white/10 bg-white/[0.06] p-2 backdrop-blur-sm",
        className
      )}
    >
      {beats.map((b, i) => {
        const done = i < index;
        const now = i === index;
        return (
          <li
            key={b.id}
            className={cn(
              "flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors",
              now && "bg-white/10"
            )}
          >
            <span
              className={cn(
                "flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border transition-colors",
                done
                  ? "border-habits bg-habits"
                  : now
                    ? "border-white/70"
                    : "border-white/25"
              )}
            >
              {done && <Check className="h-2.5 w-2.5 text-white" strokeWidth={4} />}
              {now && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
            </span>
            <span
              className={cn(
                "font-mono text-[10.5px] uppercase tracking-wider transition-colors",
                done ? "text-white/45 line-through" : now ? "font-bold text-white" : "text-white/40"
              )}
            >
              {b.step}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Live feedback on the capture mission's three tokens. Telling someone their
 * input is wrong is useless; showing them which of the three parts is still
 * missing is a game.
 */
export function TokenChecks({
  checks,
}: {
  checks: { label: string; ok: boolean }[];
}) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      {checks.map((c) => (
        <span
          key={c.label}
          className={cn(
            "flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] transition-all",
            c.ok
              ? "border-habits bg-habits/10 font-semibold text-habits"
              : "border-border bg-surface2 text-faint2"
          )}
        >
          <span
            className={cn(
              "flex h-3 w-3 items-center justify-center rounded-full border",
              c.ok ? "border-habits bg-habits" : "border-faint2"
            )}
          >
            {c.ok && <Check className="h-2 w-2 text-white" strokeWidth={5} />}
          </span>
          {c.label}
        </span>
      ))}
    </div>
  );
}
