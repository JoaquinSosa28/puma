"use client";

// The projector. Watch beats run on a clock; missions wait for the user and
// have no clock at all — which is why progress is counted in beats rather than
// seconds. The tour can't be skipped once it starts; that's the joke the intro
// card sets up, and it's short enough to be one.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BEATS, progressAt } from "@/lib/tutorial";
import { markTutorialSeen } from "@/lib/actions/settings";
import { setTutorialActive } from "@/lib/tutorial-lock";
import { TutorialIntro } from "@/components/tutorial/TutorialIntro";
import {
  MissionBanner,
  TutorialChecklist,
} from "@/components/tutorial/TutorialChrome";
import {
  SceneAssistant,
  SceneBulk,
  SceneBulkWatch,
  SceneLife,
  SceneTab,
  SceneTag,
  SceneType,
} from "@/components/tutorial/TutorialScenes";

/** How long a cleared mission holds on its "✓ …" before moving on. */
const CLEARED_HOLD_MS = 1400;

export function TutorialOverlay() {
  const router = useRouter();
  const [playing, setPlaying] = useState(false);
  const [finished, setFinished] = useState(false);
  const [index, setIndex] = useState(0);
  const [cleared, setCleared] = useState(false);
  /** Watch beats only: 0–1 through the current scene. */
  const [p, setP] = useState(0);
  const raf = useRef(0);

  // ⌘ and shift are the whole point of one mission, and neither exists on a
  // touch screen — so there it plays instead of being asked for.
  const canModifierClick = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia?.("(pointer: fine)").matches !== false,
    []
  );

  const beat = BEATS[index];
  const isMission = beat.kind === "do" && (beat.id !== "bulk" || canModifierClick);

  const advance = useCallback(() => {
    setIndex((i) => {
      if (i + 1 >= BEATS.length) return i;
      return i + 1;
    });
    setCleared(false);
    setP(0);
  }, []);

  const finish = useCallback(() => {
    setFinished(true);
    void markTutorialSeen().then(() => router.refresh());
  }, [router]);

  /** A mission reports itself done; hold on the payoff, then move on. */
  const onDone = useCallback(() => {
    setCleared(true);
    window.setTimeout(() => {
      if (index + 1 >= BEATS.length) finish();
      else advance();
    }, CLEARED_HOLD_MS);
  }, [index, advance, finish]);

  // The clock, for watch beats only.
  //
  // It counts frames rather than wall-clock time on purpose. Switch tabs and
  // the browser stops serving frames, but performance.now() keeps running —
  // so a wall-clock beat would be over the instant you came back, and you'd
  // have missed the only thing it had to show you. Accumulating between
  // frames pauses the scene while nobody's watching and resumes it when they
  // are.
  useEffect(() => {
    if (!playing || finished || isMission) return;
    const ms = beat.ms ?? 9_000;
    let elapsed = 0;
    let last = performance.now();
    const tick = (now: number) => {
      // A gap longer than a stutter is a tab switch, not a slow frame.
      elapsed += Math.min(now - last, 100);
      last = now;
      const t = elapsed / ms;
      if (t >= 1) {
        setP(1);
        if (index + 1 >= BEATS.length) finish();
        else advance();
        return;
      }
      setP(t);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [playing, finished, isMission, beat.ms, index, advance, finish]);

  // A tour that scrolls out from under itself is worse than no tour.
  useEffect(() => {
    if (!playing || finished) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [playing, finished]);

  // Take the keyboard off the app underneath. The overlay stops pointers by
  // covering them; keys reach window listeners regardless of what's drawn on
  // top, and the capture bar has three of them.
  useEffect(() => {
    if (!playing || finished) return;
    setTutorialActive(true);
    return () => setTutorialActive(false);
  }, [playing, finished]);

  // Tab belongs to the tour: one mission is about it, and everywhere else it
  // would walk the focus ring into the app behind the overlay. Same for the
  // shortcuts the browser hands to the page.
  useEffect(() => {
    if (!playing || finished) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Tab") e.preventDefault();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [playing, finished]);

  if (finished) return null;
  if (!playing) return <TutorialIntro onStart={() => setPlaying(true)} />;

  const missionNumber = BEATS.slice(0, index).filter((b) => b.kind === "do").length;
  const missionTotal = BEATS.filter((b) => b.kind === "do").length;

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-black/70 backdrop-blur-[3px]">
      <div className="h-[3px] w-full shrink-0 bg-white/15">
        <div
          className="h-full bg-primary transition-[width] duration-500"
          style={{ width: `${progressAt(index + (cleared ? 1 : 0)) * 100}%` }}
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-5 px-4 py-4">
        <MissionBanner
          beat={{ ...beat, kind: isMission ? "do" : "watch" }}
          index={missionNumber}
          total={missionTotal}
          cleared={cleared}
        />

        <div key={beat.id} className="tutorial-in flex w-full justify-center">
          <Scene
            id={beat.id}
            p={p}
            done={cleared}
            onDone={onDone}
            asMission={isMission}
          />
        </div>
      </div>

      {/* Desktop: down the left, out of the way. Phone: a strip along the
          bottom, where there's width to spare and no height. */}
      <TutorialChecklist
        beats={BEATS}
        index={index}
        className="pointer-events-none absolute left-5 top-1/2 hidden -translate-y-1/2 lg:flex"
      />
      <div className="shrink-0 px-4 pb-4 lg:hidden">
        <TutorialChecklist
          beats={BEATS}
          index={index}
          className="pointer-events-none mx-auto max-w-[560px] flex-row justify-between overflow-x-auto"
        />
      </div>
    </div>
  );
}

function Scene({
  id,
  p,
  done,
  onDone,
  asMission,
}: {
  id: (typeof BEATS)[number]["id"];
  p: number;
  done: boolean;
  onDone: () => void;
  asMission: boolean;
}) {
  switch (id) {
    case "type":
      return <SceneType onDone={onDone} done={done} />;
    case "tab":
      return <SceneTab onDone={onDone} done={done} />;
    case "tag":
      return <SceneTag onDone={onDone} done={done} />;
    case "bulk":
      return asMission ? (
        <SceneBulk onDone={onDone} done={done} />
      ) : (
        <SceneBulkWatch p={p} />
      );
    case "assistant":
      return <SceneAssistant p={p} />;
    case "life":
      return <SceneLife p={p} />;
  }
}
