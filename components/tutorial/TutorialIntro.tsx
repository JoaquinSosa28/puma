"use client";

import { useState } from "react";
import { Play, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The card that opens the tour, and the joke it tells.
 *
 * Skip is real-looking and never works, but the bit is over in two clicks
 * rather than running forever: the first press makes the buttons trade places,
 * the second appears to accept the skip and then — mid-press — relabels itself
 * and starts anyway. A gag that can't be escaped for longer than that stops
 * being a gag, so this one gets in and out.
 */
export function TutorialIntro({ onStart }: { onStart: () => void }) {
  // 0 — untouched · 1 — buttons have swapped · 2 — the fake-out is playing
  const [stage, setStage] = useState<0 | 1 | 2>(0);
  const swapped = stage >= 1;

  const onSkip = () => {
    if (stage === 0) {
      setStage(1);
      return;
    }
    if (stage === 1) {
      // "Skipping…" for a beat, then the punchline, then it just plays.
      setStage(2);
      window.setTimeout(onStart, 1600);
    }
  };

  const skipButton = (
    <button
      key="skip"
      type="button"
      onClick={onSkip}
      disabled={stage === 2}
      className={cn(
        "flex flex-1 items-center justify-center gap-2 rounded-xl border-2 px-4 py-3 text-[13.5px] font-bold transition-all duration-300",
        stage === 2
          ? "border-primary bg-primary text-background"
          : "border-tasks/50 text-tasks hover:bg-tasks/10 active:scale-95"
      )}
    >
      {stage === 2 ? (
        <Play className="h-3.5 w-3.5 fill-current" />
      ) : (
        <X className="h-3.5 w-3.5" />
      )}
      {stage === 2 ? "ok, starting tutorial" : "Skip"}
    </button>
  );

  const startButton = (
    <button
      key="start"
      type="button"
      onClick={onStart}
      disabled={stage === 2}
      className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-ink px-4 py-3 text-[13.5px] font-bold text-background transition-all duration-300 hover:opacity-90 active:scale-95 disabled:opacity-40"
    >
      <Play className="h-3.5 w-3.5 fill-current" />
      Let&apos;s go
    </button>
  );

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/55 px-4 backdrop-blur-sm">
      <div className="animate-puma-bloom w-full max-w-[420px] rounded-[20px] border-2 border-ink bg-surface p-6 shadow-[0_24px_64px_rgba(0,0,0,0.35)]">
        <span className="inline-grid h-11 w-11 place-items-center rounded-[12px] bg-ink font-mono text-[18px] font-extrabold text-background">
          P
        </span>
        <h2 className="m-0 mt-4 text-[22px] font-extrabold leading-tight tracking-tight text-ink">
          Sixty seconds, then it&apos;s yours.
        </h2>
        <p className="m-0 mt-2 text-[13.5px] leading-relaxed text-muted">
          The six things about PUMA you would never guess on your own. No
          feature tour, no checklist — just watch.
        </p>

        {/* The two buttons trade DOM positions, so the swap is a real move
            rather than two labels changing text. */}
        <div className="mt-6 flex gap-2.5">
          {swapped ? [startButton, skipButton] : [skipButton, startButton]}
        </div>

        <p
          className={cn(
            "m-0 mt-3 text-center font-mono text-[10.5px] transition-opacity duration-300",
            stage === 0 ? "text-faint2" : "text-faint"
          )}
        >
          {stage === 0 && "60 seconds. You can spare it."}
          {stage === 1 && "…that's not where it was, is it."}
          {stage === 2 && "skipped successfully ✓"}
        </p>
      </div>
    </div>
  );
}
