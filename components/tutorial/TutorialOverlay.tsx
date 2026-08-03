"use client";

// The projector: holds the clock, picks the scene, draws the caption and the
// draining bar. The tour cannot be skipped once it starts — that's the joke
// the intro card sets up — but it is 60 seconds and it says so.
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BEATS, beatAt, totalMs } from "@/lib/tutorial";
import { markTutorialSeen } from "@/lib/actions/settings";
import { TutorialIntro } from "@/components/tutorial/TutorialIntro";
import {
  SceneAssistant,
  SceneBulk,
  SceneLife,
  SceneTab,
  SceneTag,
  SceneType,
} from "@/components/tutorial/TutorialScenes";
import { cn } from "@/lib/utils";

const TOTAL = totalMs();

export function TutorialOverlay() {
  const router = useRouter();
  const [playing, setPlaying] = useState(false);
  const [done, setDone] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef(0);
  const raf = useRef(0);

  const finish = useCallback(() => {
    setDone(true);
    void markTutorialSeen().then(() => router.refresh());
  }, [router]);

  useEffect(() => {
    if (!playing || done) return;
    startedAt.current = performance.now();
    const tick = (now: number) => {
      const t = now - startedAt.current;
      if (t >= TOTAL) {
        setElapsed(TOTAL);
        finish();
        return;
      }
      setElapsed(t);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [playing, done, finish]);

  // While it plays the page behind must not move — a tour that scrolls out
  // from under itself is worse than no tour.
  useEffect(() => {
    if (!playing || done) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [playing, done]);

  if (done) return null;
  if (!playing) return <TutorialIntro onStart={() => setPlaying(true)} />;

  const { beat, index, progress } = beatAt(elapsed);
  const overall = elapsed / TOTAL;

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-black/70 backdrop-blur-[3px]">
      {/* One bar draining over the whole minute — no "step 3 of 6", because
          this is meant to feel like a film rather than a form. */}
      <div className="h-[3px] w-full shrink-0 bg-white/15">
        <div
          className="h-full bg-primary"
          style={{ width: `${overall * 100}%` }}
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 px-5">
        <div key={beat.id} className="tutorial-in flex w-full justify-center">
          <Scene id={beat.id} p={progress} />
        </div>

        <div key={`${beat.id}-cap`} className="tutorial-in max-w-[560px] text-center">
          <p className="m-0 text-[19px] font-extrabold leading-tight tracking-tight text-white sm:text-[22px]">
            {beat.caption}
          </p>
          {beat.sub && (
            <p className="m-0 mt-1.5 text-[13px] leading-relaxed text-white/60">
              {beat.sub}
            </p>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-center gap-1.5 pb-6">
        {BEATS.map((b, i) => (
          <span
            key={b.id}
            className={cn(
              "h-1 rounded-full transition-all duration-500",
              i === index ? "w-6 bg-white" : i < index ? "w-1.5 bg-white/50" : "w-1.5 bg-white/20"
            )}
          />
        ))}
      </div>
    </div>
  );
}

function Scene({ id, p }: { id: (typeof BEATS)[number]["id"]; p: number }) {
  switch (id) {
    case "type":
      return <SceneType p={p} />;
    case "tab":
      return <SceneTab p={p} />;
    case "tag":
      return <SceneTag p={p} />;
    case "bulk":
      return <SceneBulk p={p} />;
    case "assistant":
      return <SceneAssistant p={p} />;
    case "life":
      return <SceneLife p={p} />;
  }
}
