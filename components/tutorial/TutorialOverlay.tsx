"use client";

// The projector. Watch beats run on a clock; missions wait for the user and
// have no clock at all — which is why progress is counted in beats rather than
// seconds. The tour can't be skipped once it starts; that's the joke the intro
// card sets up, and it's short enough to be one.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BEATS, isFloundering, progressAt } from "@/lib/tutorial";
import { markTutorialSeen } from "@/lib/actions/settings";
import { setTutorialActive } from "@/lib/tutorial-lock";
import { TutorialIntro } from "@/components/tutorial/TutorialIntro";
import {
  FlounderCard,
  MissionBanner,
  TutorialChecklist,
} from "@/components/tutorial/TutorialChrome";
import {
  SceneAssistant,
  SceneBulk,
  SceneBulkWatch,
  SceneLife,
  SceneTab,
  SceneTabTouch,
  SceneTag,
  SceneType,
} from "@/components/tutorial/TutorialScenes";
import { cn } from "@/lib/utils";

/** How long a cleared mission holds on its "✓ …" before moving on. */
const CLEARED_HOLD_MS = 1400;
/** The closing sweep — long enough to read as a transition, short enough not
 *  to be a thing you sit through. */
const OUTRO_MS = 900;

export function TutorialOverlay() {
  const router = useRouter();
  const [playing, setPlaying] = useState(false);
  const [finished, setFinished] = useState(false);
  const [index, setIndex] = useState(0);
  const [cleared, setCleared] = useState(false);
  const [outro, setOutro] = useState(false);
  const [floundering, setFloundering] = useState(false);
  const [dismissedFlounder, setDismissedFlounder] = useState(false);
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
  // ⌘, shift and Tab are the point of two of these beats, and none of them
  // exist on a touch screen: there, the bulk beat plays itself and the Tab
  // beat becomes the type pills it maps to.
  const isMission =
    beat.kind === "do" &&
    (["bulk", "tab"].includes(beat.id) ? canModifierClick : true);

  const advance = useCallback(() => {
    setIndex((i) => {
      if (i + 1 >= BEATS.length) return i;
      return i + 1;
    });
    setCleared(false);
    setP(0);
  }, []);

  // Leaving is a sweep of light across the screen, not a disappearance: the
  // overlay is the size of the window, and something that size vanishing
  // between two frames reads as a glitch rather than an ending.
  const finish = useCallback(() => {
    setOutro(true);
    void markTutorialSeen();
    window.setTimeout(() => {
      setFinished(true);
      router.refresh();
    }, OUTRO_MS);
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

  // Has this beat been open a while, with the keyboard getting nowhere?
  // Counted per beat and reset by progress, so a slow reader is never accused
  // of anything — only someone who is both stuck and busy.
  const beatOpenedAt = useRef(performance.now());
  const strayKeys = useRef(0);
  useEffect(() => {
    beatOpenedAt.current = performance.now();
    strayKeys.current = 0;
    setFloundering(false);
  }, [index]);

  useEffect(() => {
    if (!playing || finished || dismissedFlounder || !isMission) return;
    const id = window.setInterval(() => {
      if (isFloundering(performance.now() - beatOpenedAt.current, strayKeys.current)) {
        setFloundering(true);
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [playing, finished, dismissedFlounder, isMission, index]);

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

  // The input gate. Each beat declares the keys it wants and everything else
  // is swallowed, so there is exactly one thing to do at any moment and no way
  // to wander off and break the scene. Browser combos (⌘R, ⌘L, F5) are left
  // alone deliberately — trapping someone in a tab is a different and much
  // worse thing than asking them to press Tab.
  useEffect(() => {
    if (!playing || finished) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const wantsTyping = beat.id === "type";
      const wantsTab = beat.id === "tab" && isMission;
      if (e.key === "Tab") {
        // Never let Tab walk the focus ring into the app underneath, whether
        // or not this beat is the one about Tab.
        e.preventDefault();
        if (!wantsTab) strayKeys.current += 1;
        return;
      }
      if (wantsTyping) return;
      // Anything else, on a beat not listening for it: swallowed, and noted.
      // Enough of these is what opens the door out.
      if (e.key.length === 1 || e.key === "Enter" || e.key === "Backspace") {
        e.preventDefault();
        strayKeys.current += 1;
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [playing, finished, beat.id, isMission]);

  if (finished) return null;
  if (!playing) return <TutorialIntro onStart={() => setPlaying(true)} />;

  const missionNumber = BEATS.slice(0, index).filter((b) => b.kind === "do").length;
  const missionTotal = BEATS.filter((b) => b.kind === "do").length;

  return (
    <div
      className={cn(
        "fixed inset-0 z-[200] flex flex-col bg-black/70 backdrop-blur-[3px]",
        outro && "tutorial-outro"
      )}
    >
      {outro && (
        <span className="tutorial-sweep pointer-events-none absolute inset-0" aria-hidden />
      )}
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

      {floundering && !outro && (
        <FlounderCard
          onLeave={finish}
          onStay={() => {
            setFloundering(false);
            setDismissedFlounder(true);
          }}
        />
      )}
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
      // No Tab key on a phone: the beat becomes the pills it maps to.
      return asMission ? (
        <SceneTab onDone={onDone} done={done} />
      ) : (
        <SceneTabTouch onDone={onDone} done={done} />
      );
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
