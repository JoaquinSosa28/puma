"use client";

// The stage. Each scene is a small PUMA built from the same tokens as the real
// one — a sandbox rather than a spotlight on the live UI, because the tour runs
// on a brand-new account where the live UI is six empty boxes.
//
// The gestures inside it are the real thing: a real input taking real
// keystrokes, a real Tab, a real contextmenu, real ⌘/shift clicks running
// through the very selection reducer the app uses. Nothing here writes to the
// server — it's the muscle memory that has to transfer, not the data.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, MousePointerClick, Sparkles, Tag as TagIcon } from "lucide-react";
import { nextHold, typedChars } from "@/lib/tutorial";
import { startTutorialClock } from "@/lib/tutorial-clock";
import { completeOmniToken, tokenAtCaret } from "@/lib/omni-complete";
import {
  reduceSelection,
  type SelectionState,
} from "@/lib/task-selection";
import { cn } from "@/lib/utils";

const TASK_RED = "oklch(0.64 0.18 25)";
const HABIT_GREEN = "oklch(0.6 0.13 155)";
const GOAL_PURPLE = "oklch(0.58 0.17 300)";
const PROJECT_BLUE = "oklch(0.58 0.14 245)";
const FINANCE_AMBER = "oklch(0.7 0.12 70)";

/** Ease so scripted motion lands rather than arriving at constant speed. */
const ease = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

/** A window inside a beat, normalised to 0–1. */
const phase = (p: number, from: number, to: number) =>
  Math.min(1, Math.max(0, (p - from) / (to - from)));

/** No right mouse button on a phone, so the mime has to change with it. */
const isTouch = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(pointer: fine)").matches === false;

/** Missions report completion once; the overlay handles moving on. */
export type SceneProps = {
  onDone: () => void;
  done: boolean;
  /** The line to put in the big banner — the ask, not the theme. */
  onInstruction?: (text: string) => void;
  /** A keystroke this step wasn't listening for. Enough of them opens the
   *  door out, so the scene has to say when one happens. */
  onStray?: () => void;
  /** A keystroke it WAS listening for. The idle clock measures time since
   *  anything worked, not time since the step changed — otherwise someone
   *  typing their way through a long step gets told they're stuck. */
  onProgress?: () => void;
};

// ---------------------------------------------------------------------------
// Shared furniture

function Frame({
  children,
  className,
  glow,
}: {
  children: React.ReactNode;
  className?: string;
  /** Something is waiting on you — said with a ring rather than an arrow. */
  glow?: boolean;
}) {
  return (
    <div
      className={cn(
        "w-full max-w-[560px] rounded-[16px] border bg-surface p-4 transition-shadow duration-300",
        glow
          ? "border-primary shadow-[0_0_0_4px_oklch(0.55_0.16_274/0.25),0_18px_50px_rgba(0,0,0,0.22)]"
          : "border-border shadow-[0_18px_50px_rgba(0,0,0,0.22)]",
        className
      )}
    >
      {children}
    </div>
  );
}

function Caret() {
  return (
    <span className="ml-px inline-block h-[15px] w-[2px] translate-y-[3px] animate-pulse bg-ink" />
  );
}

const DAY_RE =
  /^(today|tonight|tomorrow|mon|tue|wed|thu|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/i;
/** The same words, findable anywhere in a line rather than anchored. */
const DAY_RE_G =
  /\b(today|tonight|tomorrow|mon|tue|wed|thu|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi;

/** Colour the bits the parser treats specially — the point of the first beat. */
function tokenise(text: string) {
  return text.split(/(\s+)/).map((word, i) => {
    if (word.startsWith("#") && word.length > 1) {
      return (
        <span
          key={i}
          className="rounded-[5px] px-[5px] py-px font-mono text-[13px]"
          style={{ color: FINANCE_AMBER, background: "oklch(0.7 0.12 70 / 0.14)" }}
        >
          {word}
        </span>
      );
    }
    if (word.startsWith("!") && word.length > 1) {
      return (
        <span key={i} className="font-mono text-[13px]" style={{ color: TASK_RED }}>
          {word}
        </span>
      );
    }
    if (DAY_RE.test(word)) {
      return (
        <span key={i} className="text-primary underline decoration-dotted underline-offset-4">
          {word}
        </span>
      );
    }
    return <span key={i}>{word}</span>;
  });
}

function Row({
  title,
  accent,
  className,
  style,
  children,
  ...rest
}: {
  title: string;
  accent: string;
  children?: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-lg border border-border2 bg-surface px-3 py-2.5",
        className
      )}
      style={{ borderLeft: `3px solid ${accent}`, ...style }}
      {...rest}
    >
      {children}
      <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-ink">
        {title}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 1 — type anywhere · MISSION
//
// Step-locked rather than open. "Write a task with a day and a tag" leaves
// three things to guess at once and a blank box to guess them in; each step
// here asks for exactly one keystroke's worth of idea, refuses the others, and
// says why. The tag step teaches the thing nobody finds on their own: a
// half-typed #tag completes on Tab, and rotates while more than one matches.
//
// The rotation runs through the app's own completeOmniToken, so what the tour
// teaches and what the bar does can't drift apart.

/** The sandbox's tags. Three match "p", exactly one matches "pu" — which is
 *  the whole lesson: more letters, fewer options, one Tab. */
const DEMO_TAGS = ["prime", "pumma", "personal"];

const DAY_SUGGESTIONS = ["friday", "tomorrow", "monday"];

/** Every day word the parser knows, for the "is this word finished?" check. */
const DAY_WORD_LIST = [
  "today", "tonight", "tomorrow",
  "mon", "tue", "wed", "thu", "fri", "sat", "sun",
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
];

/**
 * A finished day word: one the parser accepts that no longer one starts with.
 *
 * "fri" is a valid token, so matching on any-day-word snatched the step away
 * mid-"friday" and then rejected the "day" still being typed. Waiting until
 * the word can't grow lets people finish the word they're writing.
 */
function daySettled(text: string): boolean {
  const word = (text.match(/[a-z]+$/i)?.[0] ?? "").toLowerCase();
  if (!word) {
    // A space or punctuation just ended whatever came before it.
    const prev = (text.trimEnd().match(/[a-z]+$/i)?.[0] ?? "").toLowerCase();
    return DAY_WORD_LIST.includes(prev);
  }
  if (!DAY_WORD_LIST.includes(word)) return false;
  return !DAY_WORD_LIST.some((d) => d.length > word.length && d.startsWith(word));
}

type CaptureStep = "title" | "day" | "hash" | "letter" | "rotate" | "narrow" | "send";

const STEP_ORDER: CaptureStep[] = ["title", "day", "hash", "letter", "rotate", "narrow", "send"];

const STEP_COPY: Record<CaptureStep, { ask: string; why: string }> = {
  title: { ask: "Type a task. Anything.", why: "no field focused — it just goes in" },
  day: { ask: "Add a day, then press space.", why: "plain english, anywhere in the line" },
  hash: { ask: "Press #", why: "that's how a tag starts" },
  letter: { ask: "Type one letter: p", why: "just the one — then stop" },
  rotate: { ask: "Press Tab", why: "three tags start with p — Tab walks them" },
  narrow: { ask: "Type u", why: "more letters, fewer options" },
  send: { ask: "Press Enter", why: "one line, fully parsed" },
};

export function SceneType({
  onDone,
  done,
  onInstruction,
  onStray,
  onProgress,
}: SceneProps) {
  const [text, setText] = useState("");
  const [step, setStep] = useState<CaptureStep>("title");
  const [tabs, setTabs] = useState(0);
  const [shake, setShake] = useState(false);
  const [captured, setCaptured] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const rotateRef = useRef<{ from: string; index: number; base: string } | null>(null);
  // Typing arrives faster than React re-renders: paste, dictation and anyone
  // typing quickly deliver several changes in a single tick, and a handler
  // reading `text` from its render closure sees the same stale value for all
  // of them — so only the last character survives. These mirror the state so
  // each edit is judged against the one before it.
  const textRef = useRef("");
  const stepRef = useRef<CaptureStep>("title");
  // Tab's guess, shown after the caret but not owned by you: typing replaces
  // it. Without this, Tab was a dead end — "#p" became "#prime" and refining
  // to "#pu" meant deleting the suggestion first.
  const [ghost, setGhost] = useState("");
  const ghostRef = useRef("");
  const setGuess = useCallback((g: string) => {
    ghostRef.current = g;
    setGhost(g);
  }, []);

  const commit = useCallback(
    (next: string) => {
      textRef.current = next;
      setText(next);
      // Anything the step accepted counts as getting on with it.
      onProgress?.();
    },
    [onProgress]
  );

  /** Tell the banner what to shout. */
  useEffect(() => {
    onInstruction?.(done ? "Captured." : STEP_COPY[step].ask);
  }, [step, done, onInstruction]);

  const goStep = useCallback((next: CaptureStep) => {
    stepRef.current = next;
    setStep(next);
  }, []);

  const reject = useCallback(() => {
    setShake(true);
    onStray?.();
    window.setTimeout(() => setShake(false), 400);
  }, [onStray]);

  // The beat is about typing without clicking first, so it had better work
  // without clicking first: any printable key re-takes the field if focus has
  // wandered — onto the frame, a chip, anywhere.
  useEffect(() => {
    inputRef.current?.focus();
    if (done) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (document.activeElement === inputRef.current) return;
      // Focus wandered — onto the frame, a chip, the backdrop, a dialog that
      // has just closed. Take it back and replay the keystroke by hand,
      // because focusing during keydown lands after the browser has already
      // decided where the character goes. The beat is about typing without
      // clicking first; it had better hold even when something has quietly
      // stolen the field.
      //
      // Tab and Enter go through the same door: handling them only on the
      // input meant the mission silently stopped responding the moment
      // anything else took focus.
      if (e.key === "Tab") {
        e.preventDefault();
        inputRef.current?.focus();
        handleTab();
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        inputRef.current?.focus();
        submit();
        return;
      }
      if (e.key.length !== 1) return;
      e.preventDefault();
      inputRef.current?.focus();
      handleChar(e.key);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, step, text, tabs]);

  // The day suggestion drifts through a few options rather than naming one, so
  // it reads as "words like these" instead of "type this exact word".
  useEffect(() => {
    if (step !== "day") return;
    const id = window.setInterval(
      () => setSuggestion((n) => (n + 1) % DAY_SUGGESTIONS.length),
      1600
    );
    return () => window.clearInterval(id);
  }, [step]);

  const titleOf = (v: string) =>
    v
      .replace(/#[a-z0-9-]*/gi, " ")
      // A fresh regex per call: a shared /g one carries lastIndex between
      // calls and starts skipping matches.
      .replace(new RegExp(DAY_RE_G.source, "gi"), " ")
      .replace(/\s+/g, " ")
      .trim();

  /**
   * The value the field now holds, reduced to the one edit that made it — so
   * a step can accept or refuse that edit. A paste of ten characters is taken
   * as its first, which keeps the lesson to one keystroke at a time without
   * having to forbid pasting outright.
   */
  function handleValue(next: string) {
    if (done) return;
    const current = textRef.current;
    if (next.length < current.length) {
      // Backspace, only within the step you're on: rubbing out a finished
      // step would leave the lesson and the text disagreeing.
      const st = stepRef.current;
      if (st === "title" || st === "day") commit(next);
      return;
    }
    if (next.length === current.length) return;
    if (!next.startsWith(current)) return reject();
    // One character at a time, even from a paste — the step machine judges
    // keystrokes, and ten at once is ten decisions it never got to make.
    for (const ch of next.slice(current.length)) handleChar(ch);
  }

  /** One character, judged against the step we're on. */
  function handleChar(ch: string) {
    if (done) return;
    const current = textRef.current;
    switch (stepRef.current) {
      case "title": {
        // A space is how you finish a word — and how this step ends, once
        // there's actually something there.
        if (ch === " " && titleOf(current).length >= 3) {
          commit(current + " ");
          goStep("day");
          return;
        }
        commit(current + ch);
        return;
      }
      case "day": {
        // A finished day word wants the space that ends it — the same
        // keystroke Tab-completion would have added for you. Any OTHER space
        // is just a space: people write "pay rent on friday", and refusing
        // the gaps between their own words is not a lesson about days.
        commit(current + ch);
        if (ch === " " && daySettled(current)) goStep("hash");
        return;
      }
      case "hash": {
        if (ch !== "#") return reject();
        commit((current.endsWith(" ") ? current : current + " ") + "#");
        goStep("letter");
        return;
      }
      case "letter": {
        if (ch.toLowerCase() !== "p") return reject();
        commit(current + "p");
        goStep("rotate");
        return;
      }
      case "rotate":
        // Typing more would work in real life, but then nobody would ever see
        // the rotation — which is the only reason this beat exists.
        return reject();
      case "narrow": {
        if (ch.toLowerCase() !== "u") return reject();
        // Your character replaces Tab's guess, exactly as it does in the bar.
        setGuess("");
        commit(current + "u");
        rotateRef.current = null;
        return;
      }
      case "send":
        // Only Enter from here. Another character would edit a line the tour
        // has already declared finished.
        return reject();
    }
  }

  /** Tab: the same completion the real bar runs, rotation and all. */
  /** The part of the current #token that the user actually typed. */
  function typedWord(value: string): string {
    return value.match(/#([a-z0-9-]*)$/i)?.[1] ?? "";
  }

  function handleTab() {
    const st = stepRef.current;
    if (st !== "rotate" && st !== "narrow") return reject();
    const value = textRef.current;
    const caret = value.length;
    const again = rotateRef.current?.from === value;
    const result = completeOmniToken(
      value,
      caret,
      DEMO_TAGS,
      again ? rotateRef.current!.index + 1 : undefined,
      again ? rotateRef.current!.base : undefined
    );
    if (!result) return reject();

    // Your text stays yours; the guess lives beside it. On an exact match
    // there's nothing left to guess, so it's written out for real.
    if (result.exact) {
      setGuess("");
      commit(result.text);
    } else {
      setGuess(result.completion.slice(typedWord(value).length));
    }
    // Keyed on the text as it stands, not on what the completion would make
    // it: the guess lives beside the field rather than in it, so the value is
    // unchanged and a second Tab has to recognise itself as the same cycle —
    // otherwise every press starts over and lands on the first candidate
    // again, which looks exactly like Tab being broken.
    rotateRef.current = result.exact
      ? null
      : {
          from: value,
          index: again ? rotateRef.current!.index + 1 : 0,
          base: again ? rotateRef.current!.base : tokenAtCaret(value, caret)?.word ?? "",
        };

    const seen = tabs + 1;
    setTabs(seen);
    onProgress?.();

    if (st === "rotate") {
      // Two presses is enough to see it move; then the better trick. Your
      // text is already just "#p" — only the guess beside it was changing.
      if (seen >= 2) {
        window.setTimeout(() => {
          rotateRef.current = null;
          goStep("narrow");
        }, 600);
      }
      return;
    }
    // narrow: one candidate left, so that Tab settled it.
    if (result.exact) window.setTimeout(() => goStep("send"), 260);
  }

  const submit = () => {
    if (stepRef.current !== "send") return reject();
    setCaptured((textRef.current + ghostRef.current).trim());
    setGuess("");
    commit("");
    onDone();
  };

  const copy = STEP_COPY[step];
  const stepNumber = STEP_ORDER.indexOf(step) + 1;

  return (
    <Frame glow={!done}>
      <div className="mb-3 flex items-baseline gap-2">
        <span className="shrink-0 rounded-full bg-ink px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest text-background">
          Step {stepNumber}/{STEP_ORDER.length}
        </span>
        <span className="min-w-0 flex-1 truncate text-[13.5px] font-bold text-ink">
          {done ? "Captured." : copy.ask}
        </span>
      </div>

      <div
        className={cn(
          "flex items-center gap-2.5 rounded-[13px] border-2 bg-surface px-3.5 py-3 transition-colors",
          shake ? "tutorial-shake border-tasks" : "border-ink"
        )}
        onClick={() => inputRef.current?.focus()}
      >
        <span
          className="shrink-0 rounded-[7px] px-[9px] py-1 font-mono text-[11px] font-semibold lowercase text-background"
          style={{ background: TASK_RED }}
        >
          task
        </span>
        <div className="relative min-w-0 flex-1">
          {/* whitespace-pre, or HTML eats the spaces between the tokens and
              "pay rent" is shown back as "payrent". */}
          <div className="pointer-events-none flex items-center truncate whitespace-pre text-[15px] font-medium text-ink">
            {text ? tokenise(text) : <span className="text-faint2">start typing…</span>}
            {!done && <Caret />}
            {/* Tab's guess: after the caret, dimmed, and not yours until you
                take it. Type instead and it's gone. */}
            {ghost && (
              <span
                className="shrink-0 rounded-[3px] font-mono text-[13px]"
                style={{ color: FINANCE_AMBER, background: "oklch(0.7 0.12 70 / 0.22)" }}
              >
                {ghost}
              </span>
            )}
            {/* The drifting hint, parked at the caret. */}
            {step === "day" && (
              <span
                key={suggestion}
                className="tutorial-in ml-1 shrink-0 font-medium text-faint2"
              >
                {DAY_SUGGESTIONS[suggestion]}?
              </span>
            )}
          </div>
          <input
            ref={inputRef}
            value={text}
            // Text comes from the VALUE changing, not from keydown. A phone
            // keyboard, an IME, dictation and paste all change the value
            // without ever reporting a key — reading keydown looks fine on a
            // laptop and silently ignores half the ways people type.
            onChange={(e) => handleValue(e.target.value)}
            onKeyDown={(e) => {
              // These two produce no text, so they can only be seen here.
              if (e.key === "Tab") {
                e.preventDefault();
                handleTab();
                return;
              }
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
            disabled={done}
            aria-label="Capture a task"
            className="absolute inset-0 w-full bg-transparent text-[15px] font-medium text-transparent caret-transparent outline-none"
          />
        </div>
        {step === "send" && (
          <kbd className="tutorial-nudge-soft shrink-0 rounded border border-border bg-surface2 px-1.5 py-0.5 font-mono text-[10px] text-ink">
            ↵
          </kbd>
        )}
      </div>

      {/* The Tab prompt only exists while Tab is the answer — but the room for
          it is always there. It appears three steps into a seven-step mission,
          and without the reservation the whole card jumped 50px under the
          cursor at the exact moment someone was reading it. */}
      <div className="mt-3 flex min-h-[68px] flex-col items-center justify-center gap-1.5">
        {(step === "rotate" || step === "narrow") && !done ? (
          <>
            <div className="flex items-center gap-2.5">
              <span className={step === "rotate" ? "tutorial-nudge-soft" : undefined}>
                <KeyCap label="⇥ Tab" pressed={tabs} wide big />
              </span>
              <span className="font-mono text-[10.5px] text-faint">
                {step === "rotate"
                  ? `${DEMO_TAGS.length} tags start with p — press again`
                  : "one match now — Tab lands it"}
              </span>
            </div>
            <p className="m-0 font-mono text-[9.5px] text-faint2">
              shift + Tab goes back
            </p>
          </>
        ) : (
          <p className="m-0 text-center font-mono text-[10.5px] text-faint">
            {shake ? "not that one — read the step" : copy.why}
          </p>
        )}
      </div>

      <div className="mt-3 min-h-[46px]">
        {captured && (
          <Row
            title={titleOf(captured)}
            accent={TASK_RED}
            className="tutorial-in"
          >
            <span className="h-4 w-4 shrink-0 rounded-[5px] border-[1.8px] border-border" />
            <span
              className="order-last shrink-0 rounded-[5px] px-[6px] py-px font-mono text-[10px]"
              style={{ color: FINANCE_AMBER, background: "oklch(0.7 0.12 70 / 0.14)" }}
            >
              {captured.match(/#([a-z0-9-]+)/i)?.[1] ?? "tag"}
            </span>
          </Row>
        )}
      </div>
    </Frame>
  );
}

// ---------------------------------------------------------------------------
// 2 — Tab cycles what you're making · MISSION

const TYPES = [
  {
    label: "task",
    color: TASK_RED,
    hint: "pay rent friday",
    // A line per stop. Being told "wrong, try again" four times is a form;
    // being told you took a wrong door is a game.
    quip: "task. everything starts here.",
  },
  {
    label: "habit",
    color: HABIT_GREEN,
    hint: "read 20 min daily",
    quip: "habit — the things you repeat. keep going.",
  },
  {
    label: "goal",
    color: GOAL_PURPLE,
    hint: "run a half marathon",
    quip: "goal. hold it there.",
  },
  {
    label: "note",
    color: "var(--ink)",
    hint: "kitchen quotes",
    quip: "note. one too far — shift+Tab back.",
  },
  {
    label: "assistant",
    color: "var(--primary)",
    hint: "where did my time go?",
    quip: "assistant. lovely, wrong door.",
  },
];

const TAB_TARGET = 2; // goal

/** A keycap the size of a real one, that goes down when the real one does. */
function KeyCap({
  label,
  pressed,
  wide,
  big,
}: {
  label: string;
  pressed: number;
  wide?: boolean;
  big?: boolean;
}) {
  return (
    <span
      key={pressed}
      className={cn(
        "tutorial-key inline-flex items-center justify-center rounded-[9px] border-b-[4px] border-border bg-surface2 font-mono font-bold text-ink shadow-[0_2px_0_var(--shadow)]",
        big ? "px-4 py-2.5 text-[15px]" : "px-2.5 py-1.5 text-[12px]",
        wide && (big ? "px-7" : "px-4")
      )}
    >
      {label}
    </span>
  );
}

/**
 * Desktop: press Tab to walk the five types, then STAY on goal while a meter
 * fills. Arriving proves a key works; staying proves you read the label — and
 * because the meter drains faster than it fills, Tab cannot be mashed through.
 */
export function SceneTab({
  onDone,
  done,
  onInstruction,
  onProgress,
}: SceneProps) {
  const [i, setI] = useState(0);
  const [presses, setPresses] = useState(0);
  const [hold, setHold] = useState(0);
  const reported = useRef(false);
  const onTarget = i === TAB_TARGET;

  useEffect(() => {
    if (done) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      e.preventDefault();
      setPresses((n) => n + 1);
      onProgress?.();
      setI((prev) => (prev + (e.shiftKey ? -1 : 1) + TYPES.length) % TYPES.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [done, onProgress]);

  // The meter. Runs continuously so leaving drains it, rather than only
  // ticking while you happen to be in the right place.
  useEffect(() => {
    if (done) return;
    // Real time, not paused time: you cannot hold a key on a page you aren't
    // looking at, so there is nothing here to protect from a tab switch.
    return startTutorialClock(
      (dt) => setHold((h) => nextHold(h, onTarget, dt)),
      false
    );
  }, [onTarget, done]);

  useEffect(() => {
    if (reported.current || done || hold < 1) return;
    reported.current = true;
    onDone();
  }, [hold, done, onDone]);

  const current = TYPES[i];

  useEffect(() => {
    onInstruction?.(done ? "Locked in" : onTarget ? "Hold it there" : "Press Tab");
  }, [onTarget, done, onInstruction]);

  return (
    <Frame glow={!done}>
      {/* The instruction, as the key itself — nobody reads "press Tab", they
          look at a picture of the key. One key, on its own. Showing "⇧ shift + ⇥ Tab" side by side read as
          a chord you had to press together — shift is only the way back, so
          it says so underneath in small type. */}
      <div className="mb-4 flex flex-col items-center gap-2">
        <span className={cn(!presses && "tutorial-nudge-soft")}>
          <KeyCap label="⇥ Tab" pressed={presses} wide big />
        </span>
        <p className="m-0 text-center font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint">
          {presses === 0
            ? "press Tab"
            : onTarget
              ? "hold it — don't press again"
              : "again"}
          {presses > 0 && (
            <span className="ml-2 tabular-nums text-faint2">×{presses}</span>
          )}
        </p>
        <p className="m-0 font-mono text-[9.5px] text-faint2">
          shift + Tab goes back
        </p>
      </div>

      <div
        className={cn(
          "flex items-center gap-2.5 rounded-[13px] border-2 bg-surface px-3.5 py-3 transition-colors duration-300",
          onTarget ? "border-habits" : "border-ink"
        )}
      >
        <span
          className="shrink-0 rounded-[7px] px-[9px] py-1 font-mono text-[11px] font-semibold lowercase text-background transition-colors duration-300"
          style={{ background: current.color }}
        >
          {current.label}
        </span>
        <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-faint2">
          {current.hint}
        </span>
      </div>

      {/* The meter, and what the current stop has to say about itself. */}
      <div className="mt-3">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface2">
          <div
            className="h-full rounded-full transition-colors"
            style={{
              width: `${hold * 100}%`,
              background: onTarget ? HABIT_GREEN : "var(--faint2)",
            }}
          />
        </div>
        <p
          className={cn(
            "m-0 mt-2 text-center font-mono text-[10.5px] transition-colors",
            onTarget ? "font-bold text-habits" : "text-faint"
          )}
        >
          {done ? "★ goal — locked in" : current.quip}
        </p>
      </div>

      <div className="mt-3.5 flex flex-wrap justify-center gap-1.5">
        {TYPES.map((t, idx) => (
          <span
            key={t.label}
            className={cn(
              "rounded-lg border px-2.5 py-1 font-mono text-[11px] transition-all duration-300",
              idx === i
                ? "border-2 font-bold text-background"
                : idx === TAB_TARGET && !done
                  ? "border-2 border-dashed border-habits text-habits"
                  : "border-border bg-surface2 text-faint2"
            )}
            style={idx === i ? { background: t.color, borderColor: t.color } : undefined}
          >
            {idx === TAB_TARGET && idx !== i && !done ? `★ ${t.label}` : t.label}
          </span>
        ))}
      </div>
    </Frame>
  );
}

/**
 * Phone: there is no Tab key, so the beat becomes what the mobile capture
 * sheet actually offers — the row of type pills, tapped. Showing a keycap
 * nobody has would be teaching a shortcut that doesn't exist on the device
 * it's being taught on.
 */
export function SceneTabTouch({
  onDone,
  done,
  onInstruction,
  onProgress,
}: SceneProps) {
  const [i, setI] = useState(0);
  const reported = useRef(false);
  const onTarget = i === TAB_TARGET;

  useEffect(() => {
    if (reported.current || done || !onTarget) return;
    reported.current = true;
    const t = window.setTimeout(onDone, 600);
    return () => window.clearTimeout(t);
  }, [onTarget, done, onDone]);

  const current = TYPES[i];

  useEffect(() => {
    onInstruction?.(done ? "Locked in" : "Tap goal");
  }, [done, onInstruction]);

  return (
    <Frame glow={!done}>
      <p className="m-0 mb-3 text-center font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint">
        {done ? "★ goal" : "tap goal"}
      </p>

      <div
        className={cn(
          "flex items-center gap-2.5 rounded-[13px] border-2 bg-surface px-3.5 py-3 transition-colors duration-300",
          onTarget ? "border-habits" : "border-ink"
        )}
      >
        <span
          className="shrink-0 rounded-[7px] px-[9px] py-1 font-mono text-[11px] font-semibold lowercase text-background transition-colors duration-300"
          style={{ background: current.color }}
        >
          {current.label}
        </span>
        <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-faint2">
          {current.hint}
        </span>
      </div>

      <div className="mt-3.5 flex flex-wrap justify-center gap-1.5">
        {TYPES.map((t, idx) => (
          <button
            key={t.label}
            type="button"
            disabled={done}
            onClick={() => {
              onProgress?.();
              setI(idx);
            }}
            className={cn(
              "rounded-lg border px-3 py-1.5 font-mono text-[11.5px] transition-all duration-300 active:scale-95",
              idx === i
                ? "border-2 font-bold text-background"
                : idx === TAB_TARGET && !done
                  ? "border-2 border-dashed border-habits text-habits tutorial-nudge"
                  : "border-border bg-surface2 text-faint2"
            )}
            style={idx === i ? { background: t.color, borderColor: t.color } : undefined}
          >
            {idx === TAB_TARGET && idx !== i && !done ? `★ ${t.label}` : t.label}
          </button>
        ))}
      </div>
    </Frame>
  );
}

// ---------------------------------------------------------------------------
// 3 — a tag is where the thing lives · MISSION
//
// A real context menu on a real right-click, plus a long-press for touch —
// exactly the two ways the menu opens in the app.

const TAG_OPTIONS = [
  { name: "website-redesign", color: PROJECT_BLUE, project: true },
  { name: "health", color: HABIT_GREEN, project: false },
];

/**
 * Mimes the gesture on a loop until it's performed. "Right-click the task" is
 * a sentence; a cursor arriving at the row and flashing its right button is
 * the thing itself, and it needs no translating.
 */
/** One pass of the mime: glide in, settle, click, show the word, glide out. */
const CYCLE_MS = 4200;

/**
 * The click itself. Synthesised rather than fetched: it's a few milliseconds
 * of envelope and doesn't deserve a network request or a file in the repo.
 *
 * Returned as a function rather than run on its own timer, so the sound is
 * fired by the same loop that draws the press. Two clocks meant the click
 * could be seen and heard at different moments.
 */
function useClickSound(): () => void {
  const ctxRef = useRef<AudioContext | null>(null);
  useEffect(() => () => void ctxRef.current?.close(), []);

  return useCallback(() => {
    try {
      type WithLegacy = typeof window & { webkitAudioContext?: typeof AudioContext };
      const Ctor = window.AudioContext ?? (window as WithLegacy).webkitAudioContext;
      if (!Ctor) return;
      const ctx = (ctxRef.current ??= new Ctor());
      if (ctx.state === "suspended") void ctx.resume();
      const now = ctx.currentTime;
      // A short burst through a high-pass reads as a mouse button; a tone
      // reads as a notification, which is not what this is.
      const noise = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.02), ctx.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 6;
      }
      const src = ctx.createBufferSource();
      src.buffer = noise;
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 1800;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.07, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
      src.connect(hp).connect(gain).connect(ctx.destination);
      src.start(now);
    } catch {
      // Audio is decoration here. A blocked or exhausted context is not a
      // reason for the tour to stop working.
    }
  }, []);
}

/** 0 before `a`, 1 after `b`, linear between — one phase of the cycle. */
function seg(t: number, a: number, b: number): number {
  return Math.min(1, Math.max(0, (t - a) / (b - a)));
}
const easeOut = (x: number) => 1 - (1 - x) ** 3;
const easeIn = (x: number) => x ** 3;

/** Where the cursor starts and ends its pass, relative to the target. */
const ENTER_X = 52;
const ENTER_Y = 30;

function GhostCursor({ label }: { label: string }) {
  const wrapRef = useRef<HTMLSpanElement>(null);
  const armRef = useRef<HTMLSpanElement>(null);
  const burstRef = useRef<SVGSVGElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const play = useClickSound();

  // Driven from JS rather than a CSS keyframe loop, and that is not a style
  // choice. A browser pauses CSS animations outright on a page it considers
  // hidden while still serving requestAnimationFrame — so the keyframe version
  // sat perfectly still in exactly the places the rest of the tour kept
  // playing. Same clock as every other scene now, so it moves whenever they do.
  useEffect(() => {
    const wrap = wrapRef.current;
    const arm = armRef.current;
    const burst = burstRef.current;
    const tag = labelRef.current;
    if (!wrap || !arm || !burst || !tag) return;

    // Deliberately not gated on prefers-reduced-motion. Every other scene in
    // the tour moves — the assistant types, the weeks fill in — because the
    // movement IS the lesson rather than decoration around it. Parking this
    // one made the tour inconsistent with itself: five scenes playing and the
    // one miming a gesture standing perfectly still, which reads as broken.
    // The app's decorative animation still honours the preference globally.
    let t = 0;
    let clicked = false;
    return startTutorialClock((dt) => {
      const prev = t;
      t = (t + dt / CYCLE_MS) % 1;
      if (t < prev) clicked = false;

      // In, settle, press, speak, out. Unhurried on purpose: a cursor that
      // snaps about reads as a glitch, one that clicks every second nags.
      const inAt = easeOut(seg(t, 0, 0.18));
      const outAt = easeIn(seg(t, 0.84, 1));
      const away = 1 - inAt + outAt;
      const press = Math.sin(Math.PI * seg(t, 0.34, 0.44));

      wrap.style.transform = `translate(${(ENTER_X * away).toFixed(2)}px, ${(
        ENTER_Y * away
      ).toFixed(2)}px)`;
      wrap.style.opacity = String(Math.min(seg(t, 0, 0.1), 1 - seg(t, 0.9, 1)));
      arm.style.transform = `translateY(${(press * 2).toFixed(2)}px) scale(${(
        1 - press * 0.1
      ).toFixed(3)})`;

      // The strokes that fly off a click, out and gone.
      const b = seg(t, 0.38, 0.68);
      burst.style.opacity = String(b > 0 && b < 1 ? (1 - b) * 0.95 : 0);
      burst.style.transform = `scale(${(0.35 + b * 1.15).toFixed(3)})`;

      const say = seg(t, 0.4, 0.5) * (1 - seg(t, 0.7, 0.84));
      tag.style.opacity = String(say);
      tag.style.transform = `translateY(${(4 - 4 * seg(t, 0.4, 0.5) - 8 * seg(t, 0.7, 0.84)).toFixed(
        2
      )}px)`;

      if (!clicked && t >= 0.4) {
        clicked = true;
        play();
      }
    }, false);
  }, [play]);

  return (
    <span
      ref={wrapRef}
      className="pointer-events-none absolute left-[38%] top-1/2 z-20"
      style={{ opacity: 0 }}
    >
      <span className="relative block">
        {/* The click, as the strokes it throws off — centred on the arrow tip
            so it reads as coming out of the point rather than the cursor. */}
        <svg
          ref={burstRef}
          className="absolute left-[-10px] top-[-10px] h-6 w-6"
          viewBox="-12 -12 24 24"
          aria-hidden
          style={{ opacity: 0 }}
        >
          {[0, 62, 124, 186, 298].map((a) => (
            <line
              key={a}
              x1="0"
              y1="-5.5"
              x2="0"
              y2="-10"
              transform={`rotate(${a})`}
              stroke="#fff"
              strokeWidth="2"
              strokeLinecap="round"
            />
          ))}
        </svg>

        <span ref={armRef} className="block">
          <svg width="20" height="25" viewBox="0 0 18 22" aria-hidden className="block">
            {/* White, the way a cursor is — with a dark edge under it, or it
                would vanish into the card it's pointing at. */}
            <path
              d="M2 1.5 L2 17 L6 13.4 L8.8 19.6 L11.6 18.3 L8.8 12.2 L14 12.2 Z"
              fill="#fff"
              stroke="var(--ink)"
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
          </svg>
        </span>

        {/* …and the word for it, drifting up as it fades. */}
        <span
          ref={labelRef}
          className="absolute left-5 top-3 whitespace-nowrap rounded-md bg-ink px-2 py-1 font-mono text-[10px] font-bold text-background"
          style={{ opacity: 0 }}
        >
          ✳ {label}
        </span>
      </span>
    </span>
  );
}

export function SceneTag({
  onDone,
  done,
  onInstruction,
  onProgress,
}: SceneProps) {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [picked, setPicked] = useState(false);
  const pressTimer = useRef(0);

  const open = useCallback(
    (x: number, y: number) => {
      if (picked) return;
      setMenu({ x, y });
    },
    [picked]
  );

  const choose = (project: boolean) => {
    onProgress?.();
    setMenu(null);
    // The other tag is a label, not a place — picking it files nothing, which
    // is the distinction this beat is about.
    if (!project) return;
    setPicked(true);
    window.setTimeout(onDone, 900);
  };

  const landed = picked || done;

  useEffect(() => {
    onInstruction?.(
      landed
        ? "Filed"
        : menu
          ? "Pick website-redesign"
          : isTouch()
            ? "Long-press the task"
            : "Right-click the task"
    );
  }, [menu, landed, onInstruction]);

  return (
    <Frame glow={!done}>
      <div className="grid grid-cols-1 items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
        <div>
          <p className="m-0 mb-1.5 font-mono text-[9.5px] uppercase tracking-widest text-faint2">
            No project
          </p>
          {landed ? (
            <p className="m-0 rounded-lg border border-dashed border-border px-2 py-3 text-center font-mono text-[10px] text-faint2">
              empty
            </p>
          ) : (
            <Row
              title="Build hero section"
              accent={TASK_RED}
              className={cn(
                "relative cursor-context-menu select-none",
                !done && "tutorial-nudge"
              )}
              onContextMenu={(e) => {
                e.preventDefault();
                open(e.clientX, e.clientY);
              }}
              onTouchStart={(e) => {
                const t = e.touches[0];
                pressTimer.current = window.setTimeout(() => open(t.clientX, t.clientY), 450);
              }}
              onTouchEnd={() => window.clearTimeout(pressTimer.current)}
              onTouchMove={() => window.clearTimeout(pressTimer.current)}
            >
              <span className="h-4 w-4 shrink-0 rounded-[5px] border-[1.8px] border-border" />
              {!menu && (
                <GhostCursor label={isTouch() ? "long press" : "right click"} />
              )}
            </Row>
          )}
        </div>

        <TagIcon
          className="mx-auto h-4 w-4 shrink-0 rotate-90 text-faint2 sm:mx-0 sm:rotate-0"
          style={{ opacity: landed ? 1 : 0.4 }}
        />

        <div>
          <p
            className="m-0 mb-1.5 font-mono text-[9.5px] uppercase tracking-widest"
            style={{ color: landed ? PROJECT_BLUE : "var(--faint2)" }}
          >
            Website redesign
          </p>
          <div
            className="rounded-lg border border-dashed p-1 transition-colors duration-500"
            style={{ borderColor: landed ? PROJECT_BLUE : "var(--border)" }}
          >
            {landed ? (
              <Row title="Build hero section" accent={PROJECT_BLUE} className="tutorial-in">
                <span className="h-4 w-4 shrink-0 rounded-[5px] border-[1.8px] border-border" />
              </Row>
            ) : (
              <p className="m-0 px-2 py-2.5 text-center font-mono text-[10px] text-faint2">
                empty
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3.5 flex items-center justify-center gap-2 font-mono text-[10px]">
        <span
          className="rounded-[5px] px-2 py-0.5 transition-colors duration-500"
          style={
            landed
              ? { color: "var(--faint2)", background: "var(--surface2)" }
              : { color: GOAL_PURPLE, background: "oklch(0.58 0.17 300 / 0.14)" }
          }
        >
          personal
        </span>
        <span className="text-faint2">→</span>
        <span
          className="rounded-[5px] px-2 py-0.5 transition-colors duration-500"
          style={
            landed
              ? { color: PROJECT_BLUE, background: "oklch(0.58 0.14 245 / 0.16)" }
              : { color: "var(--faint2)", background: "var(--surface2)" }
          }
        >
          work
        </span>
      </div>

      {menu && (
        <>
          <div className="fixed inset-0 z-[210]" onClick={() => setMenu(null)} />
          <div
            className="tutorial-in fixed z-[211] w-[186px] rounded-lg border border-border bg-surface p-1 shadow-lg"
            style={{
              left: Math.min(menu.x, window.innerWidth - 200),
              top: Math.min(menu.y, window.innerHeight - 140),
            }}
          >
            <p className="m-0 px-1.5 pb-1 pt-1 font-mono text-[9px] tracking-widest text-faint2">
              TAG
            </p>
            {TAG_OPTIONS.map((t) => (
              <button
                key={t.name}
                type="button"
                onClick={() => choose(t.project)}
                className="flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left text-[12px] text-muted transition-colors hover:bg-hover hover:text-ink"
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: t.color }}
                />
                <span className="min-w-0 flex-1 truncate">{t.name}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </Frame>
  );
}

// ---------------------------------------------------------------------------
// 4 — pick many, change them all · MISSION
//
// Runs through the app's own selection reducer, so ⌘-click and shift-click
// behave here exactly as they will on the real list.

const BULK_ROWS = [
  "Draft launch email",
  "Send invoice to client",
  "Pay rent",
  "Build hero section",
];

/**
 * The target: the button already wearing its chosen colours, with the border
 * itself alive — one bright segment running the rim, and a hairline that
 * expands out of the edge and fades.
 *
 * The rim is a conic gradient in the 2px gutter between two rounded boxes, so
 * what shows is a moving *border*, not a glow bleeding over the label. No
 * blur, no washed-out halo: the button stays as readable as the one beside it.
 *
 * On the same rAF clock as the scenes rather than a CSS keyframe — a browser
 * stops CSS animation dead both on a page it thinks is hidden and under
 * prefers-reduced-motion, and a "press this" marker that isn't moving is a
 * marker nobody sees.
 */
function TargetBorder({ color }: { color: string }) {
  const rimRef = useRef<HTMLSpanElement>(null);
  const pulseRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const rim = rimRef.current;
    const pulse = pulseRef.current;
    if (!rim || !pulse) return;
    let t = 0;
    return startTutorialClock((dt) => {
      t = (t + dt / 2000) % 1;
      const deg = t * 360;
      // A tight bright arc on a steady base, so the border reads as lit all
      // the way round with one segment travelling it.
      // color-mix, not a "#rrggbbaa" suffix: these tokens are oklch(), and
      // "oklch(…)88" is not a colour — it invalidates the whole gradient and
      // the border silently renders as nothing at all.
      const dim = `color-mix(in oklch, ${color} 58%, transparent)`;
      rim.style.background = `conic-gradient(from ${deg.toFixed(
        1
      )}deg, ${color} 0deg, #fff 16deg, ${color} 44deg, ${dim} 140deg, ${dim} 360deg)`;
      // …and the edge letting go of a ring every other lap.
      const p = (t * 2) % 1;
      pulse.style.transform = `scale(${(1 + p * 0.34).toFixed(3)})`;
      pulse.style.opacity = (0.5 * (1 - p) ** 1.6).toFixed(3);
    }, false);
  }, [color]);

  return (
    <>
      <span
        ref={pulseRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-md border-2"
        style={{ borderColor: color, opacity: 0 }}
      />
      <span
        ref={rimRef}
        aria-hidden
        className="pointer-events-none absolute -inset-[2px] rounded-[8px]"
      />
    </>
  );
}

function BulkPanel({
  count,
  applied,
  previewing,
  armed,
  onPick,
}: {
  count: number;
  applied: boolean;
  previewing?: boolean;
  /** The rows are selected and the panel is now the thing to press. */
  armed?: boolean;
  onPick?: (level: string) => void;
}) {
  // Whatever the rows actually are right now reads as chosen. They start low,
  // so low is the one filled in — showing high as chosen before anyone had
  // pressed it made the mission look already done.
  const current = applied ? "High" : "Low";

  return (
    <div className="rounded-lg border border-border bg-surface2 p-2.5">
      <p
        className={cn(
          "m-0 text-[13px] font-bold transition-colors",
          previewing ? "text-primary/70" : "text-ink"
        )}
      >
        {count} <span className="text-[11px] font-semibold">selected</span>
      </p>
      <p className="m-0 mt-1 font-mono text-[9px] leading-relaxed text-faint2">
        {applied
          ? "all four, at once"
          : armed
            ? "one click changes all four"
            : previewing
              ? "release to take them"
              : "shift-click a range"}
      </p>
      <p className="m-0 mt-2.5 font-mono text-[9px] uppercase tracking-widest text-faint2">
        Priority
      </p>
      {/* Live once the rows are selected — the panel is the second half of the
          gesture, and a decoration you can't press teaches the wrong thing. */}
      <div className="mt-1 flex gap-1">
        {["Low", "Mid", "High"].map((l) => {
          const chosen = l === current;
          const target = !!armed && l === "High";
          return (
            <span key={l} className="relative flex-1">
              {target && <TargetBorder color={TASK_RED} />}
              <button
                type="button"
                disabled={!armed}
                onClick={() => onPick?.(l)}
                className={cn(
                  "relative w-full rounded-md border py-1 text-center font-mono text-[9px] font-bold uppercase transition-colors duration-300",
                  chosen || target ? "border-2 text-ink" : "border-border bg-surface text-faint2",
                  armed && "cursor-pointer"
                )}
                style={
                  // The target wears the chosen look already — the only thing
                  // telling it apart is that its border is moving. An opaque
                  // fill, so the rim behind it shows as a border and not a
                  // wash across the word.
                  chosen || target
                    ? {
                        borderColor: target ? "transparent" : TASK_RED,
                        // Opaque, not a 12% wash: the travelling rim sits
                        // directly behind this and would show straight through
                        // a translucent face.
                        background: `color-mix(in oklch, ${TASK_RED} 13%, var(--surface))`,
                        backgroundClip: "padding-box",
                      }
                    : undefined
                }
              >
                {l}
              </button>
            </span>
          );
        })}
      </div>
    </div>
  );
}

function BulkRow({
  title,
  picked,
  applied,
  nudge,
  ghost,
  anchor,
  onClick,
  onMouseEnter,
}: {
  title: string;
  picked: boolean;
  applied: boolean;
  nudge?: boolean;
  /** Part of the range the pointer is proposing, not yet committed. */
  ghost?: boolean;
  /** The row the tour handed over — the fixed end of the range. */
  anchor?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  onMouseEnter?: () => void;
}) {
  return (
    <Row
      title={title}
      accent={picked ? "var(--primary)" : TASK_RED}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={cn(
        "h-[44px] select-none transition-all duration-150",
        onClick && "cursor-pointer",
        picked && !ghost && "bg-primary/[0.10] ring-1 ring-inset ring-primary/40",
        // The proposed half of the range reads as lighter than the committed
        // half, so "about to take" never looks like "taken".
        ghost && "bg-primary/[0.05] ring-1 ring-inset ring-primary/25",
        anchor && "ring-2 ring-inset ring-primary/60",
        nudge && "tutorial-nudge"
      )}
    >
      <span
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border-[1.8px] transition-colors",
          picked ? "border-primary bg-primary" : "border-border"
        )}
      >
        {picked && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3.4} />}
      </span>
      <span
        className="order-last shrink-0 rounded-md px-1.5 py-px font-mono text-[9px] font-bold transition-colors duration-300"
        style={
          applied && picked
            ? { color: TASK_RED, background: "oklch(0.64 0.18 25 / 0.14)" }
            : { color: "var(--faint2)", background: "var(--surface2)" }
        }
      >
        {applied && picked ? "HIGH" : "LOW"}
      </span>
    </Row>
  );
}

/**
 * Guided rather than open: the first row arrives already selected, and the
 * only accepted move is a shift-click further down. Offering the full gesture
 * set here would mean explaining ⌘ and shift at once and letting someone
 * arrive at four selected rows by four separate clicks — which looks like
 * success and teaches nothing. One gesture, forced, shown before it's asked
 * for: hovering draws the range you're about to take.
 */
export function SceneBulk({
  onDone,
  done,
  onInstruction,
  onStray,
  onProgress,
}: SceneProps) {
  const order = useMemo(() => BULK_ROWS.map((_, i) => `r${i}`), []);
  // Row 0 is handed to you — the mission is the second half of the gesture.
  const [sel, setSel] = useState<SelectionState>({ ids: ["r0"], anchor: "r0" });
  const [hover, setHover] = useState<number | null>(null);
  // Selecting four rows proves nothing on its own — the point of a selection
  // is the edit you make through it, so the mission isn't over until one
  // click has moved all four from low to high at once.
  const [phase, setPhase] = useState<"select" | "raise" | "applied">("select");
  const [wrongClick, setWrongClick] = useState(false);
  const applied = phase === "applied";
  const reported = useRef(false);

  useEffect(() => {
    if (phase !== "select" || done || sel.ids.length < 2) return;
    setPhase("raise");
  }, [sel.ids.length, done, phase]);

  const refuse = useCallback(() => {
    setWrongClick(true);
    onStray?.();
    window.setTimeout(() => setWrongClick(false), 450);
  }, [onStray]);

  /** The whole lesson, in one click: four rows, one change. */
  const raise = (level: string) => {
    if (done || reported.current || phase !== "raise") return;
    // Low is where they already are and mid is a shrug — neither shows you
    // anything, so neither is accepted.
    if (level !== "High") return refuse();
    reported.current = true;
    onProgress?.();
    setPhase("applied");
    window.setTimeout(onDone, 1100);
  };

  const click = (index: number, e: React.MouseEvent) => {
    if (done || phase !== "select") return;
    // Only shift. A plain or ⌘ click would start a different selection and
    // quietly undo the half of the gesture the tour set up.
    if (!e.shiftKey || index === 0) return refuse();
    onProgress?.();
    window.getSelection?.()?.removeAllRanges();
    setSel((s) => reduceSelection(s, order, order[index], "range"));
  };

  // What a shift-click right now would take — drawn before it's committed.
  const preview = hover !== null && hover > 0 && !applied ? hover : null;

  useEffect(() => {
    onInstruction?.(
      applied || done
        ? "Four rows, one click"
        : phase === "raise"
          ? "Now set them all to high"
          : "Shift-click a row below"
    );
  }, [applied, done, phase, onInstruction]);

  return (
    <Frame glow={!done}>
      <div className="mb-3.5 flex items-center justify-center gap-2">
        <KeyCap label="⇧ shift" pressed={0} big />
        <span className="font-mono text-[13px] font-bold text-faint2">+</span>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-[9px] border-b-[4px] border-border bg-surface2 px-4 py-2.5 font-mono text-[15px] font-bold text-ink shadow-[0_2px_0_var(--shadow)]",
            !applied && "tutorial-nudge-soft"
          )}
        >
          <MousePointerClick className="h-4 w-4" />
          click
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_150px]">
        <div
          className={cn("relative flex flex-col gap-1.5", wrongClick && "tutorial-shake")}
          onMouseLeave={() => setHover(null)}
          onMouseDownCapture={(e) => {
            // Stop shift-drag painting a text selection down the list.
            if (e.shiftKey) e.preventDefault();
          }}
        >
          {BULK_ROWS.map((title, i) => {
            const picked = sel.ids.includes(order[i]);
            const inPreview = preview !== null && i > 0 && i <= preview;
            return (
              <BulkRow
                key={order[i]}
                title={title}
                picked={picked || inPreview}
                ghost={inPreview && !picked}
                applied={applied}
                anchor={i === 0}
                onMouseEnter={() => setHover(i)}
                onClick={(e) => click(i, e)}
              />
            );
          })}

          {/* The arrow from the row you were given to the row you're pointing
              at, so the range is a thing you can see before you commit it. */}
          {preview !== null && <RangeArrow rows={preview} />}
        </div>

        <BulkPanel
          count={applied || sel.ids.length > 1 ? sel.ids.length : (preview ?? 0) + 1}
          applied={applied}
          previewing={preview !== null && sel.ids.length < 2}
          armed={phase === "raise"}
          onPick={raise}
        />
      </div>

      <p
        className={cn(
          "m-0 mt-3 text-center font-mono text-[10.5px] transition-colors",
          wrongClick ? "font-bold text-tasks" : "text-faint"
        )}
      >
        {done || applied
          ? "★ four rows, one click"
          : wrongClick
            ? phase === "raise"
              ? "high. the one on the right."
              : "shift. hold shift, then click."
            : phase === "raise"
              ? "all four are yours now — send them to high"
              : "first one's yours — shift-click any row below it"}
      </p>
    </Frame>
  );
}

/**
 * Spans from the first row to the hovered one. Absolutely positioned over the
 * list, so it costs the rows nothing and can't shift the layout as it grows.
 */
function RangeArrow({ rows }: { rows: number }) {
  // Rows are a fixed height with a fixed gap, so the geometry is arithmetic
  // rather than a measurement — no observers, no reflow, no lag behind the
  // pointer.
  //
  // Down the middle rather than the edge, dashed and half-transparent: it's a
  // sketch of a range you haven't taken yet, and a solid line at the margin
  // looked like a permanent part of the list.
  const ROW = 44;
  const GAP = 6;
  const top = ROW / 2;
  const height = rows * (ROW + GAP);
  return (
    <svg
      className="pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2 overflow-visible"
      width="18"
      height={top + height}
      aria-hidden
    >
      <defs>
        <marker id="tut-arrow" markerWidth="7" markerHeight="7" refX="3.5" refY="3.5" orient="auto">
          <path d="M0,0 L7,3.5 L0,7 z" fill="var(--primary)" opacity="0.55" />
        </marker>
      </defs>
      <line
        x1="9"
        y1={top}
        x2="9"
        y2={top + height - 9}
        stroke="var(--primary)"
        strokeWidth="2"
        strokeDasharray="5 5"
        strokeLinecap="round"
        opacity="0.55"
        markerEnd="url(#tut-arrow)"
        className="tutorial-arrow"
      />
    </svg>
  );
}

/** Touch has no ⌘ and no shift, so on a phone this beat plays instead. */
export function SceneBulkWatch({ p }: { p: number }) {
  const ranged = p > 0.3 ? BULK_ROWS.length : p > 0.1 ? 1 : 0;
  const applied = p > 0.62;
  return (
    <Frame>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_150px]">
        <div className="flex flex-col gap-1.5">
          {BULK_ROWS.map((title, i) => (
            <BulkRow key={title} title={title} picked={i < ranged} applied={applied} />
          ))}
        </div>
        <BulkPanel count={ranged} applied={applied} />
      </div>
    </Frame>
  );
}

// ---------------------------------------------------------------------------
// 5 — ask it, or tell it · WATCH (an answer needs a model behind it)

const SLICES = [
  { label: "Website redesign", value: 42, color: PROJECT_BLUE },
  { label: "Side app MVP", value: 28, color: GOAL_PURPLE },
  { label: "Admin", value: 18, color: HABIT_GREEN },
  { label: "Unfiled", value: 12, color: FINANCE_AMBER },
];

export function SceneAssistant({ p }: { p: number }) {
  const asking = p < 0.5;
  const q = typedChars("where did my time go?", p, 0.02, 0.16);
  const cmd = typedChars("file my unfiled tasks", p, 0.5, 0.63);
  const chartIn = ease(phase(p, 0.2, 0.42));
  const draftIn = phase(p, 0.66, 0.84);

  let offset = 25;
  const arcs = SLICES.map((s) => {
    const arc = { ...s, pct: s.value, offset };
    offset -= s.value;
    return arc;
  });

  return (
    <Frame>
      <div className="flex items-center gap-2.5 rounded-[13px] border-2 border-ink bg-surface px-3.5 py-3">
        <span className="flex shrink-0 items-center gap-1 rounded-[7px] bg-primary px-[9px] py-1 font-mono text-[11px] font-semibold lowercase text-background">
          <Sparkles className="h-3 w-3" />
          assistant
        </span>
        <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-ink">
          {asking ? q : cmd}
          <Caret />
        </span>
      </div>

      <div className="mt-3 min-h-[128px]">
        {asking
          ? chartIn > 0 && (
              <div className="flex items-center gap-4 rounded-lg border border-border bg-surface p-3">
                <svg width="96" height="96" viewBox="0 0 42 42" aria-hidden>
                  <circle cx="21" cy="21" r="15.9" fill="none" stroke="var(--border)" strokeWidth="5.5" />
                  {arcs.map((a) => (
                    <circle
                      key={a.label}
                      cx="21"
                      cy="21"
                      r="15.9"
                      fill="none"
                      stroke={a.color}
                      strokeWidth="5.5"
                      strokeDasharray={`${a.pct * chartIn} ${100 - a.pct * chartIn}`}
                      strokeDashoffset={a.offset}
                    />
                  ))}
                </svg>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  {arcs.map((a) => (
                    <span key={a.label} className="flex items-center gap-2">
                      <i className="h-2 w-2 shrink-0 rounded-[2px]" style={{ background: a.color }} />
                      <span className="min-w-0 flex-1 truncate text-[11.5px] text-muted">
                        {a.label}
                      </span>
                      <span className="shrink-0 font-mono text-[10.5px] text-ink">
                        {Math.round(a.pct * chartIn)}%
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )
          : draftIn > 0 && (
              <div className="rounded-lg border border-border bg-surface p-3" style={{ opacity: draftIn }}>
                <p className="m-0 mb-2 font-mono text-[9px] uppercase tracking-widest text-faint2">
                  Changeset draft · 3 operations
                </p>
                {[
                  { t: "Pay rent", to: "Household" },
                  { t: "Call Mom", to: "Household" },
                  { t: "Review PR #214", to: "Website redesign" },
                ].map((op, i) => (
                  <div
                    key={op.t}
                    className="tutorial-in flex items-center gap-2 border-l-2 py-1.5 pl-2.5 text-[12px]"
                    style={{ borderColor: PROJECT_BLUE, animationDelay: `${i * 90}ms` }}
                  >
                    <span
                      className="flex h-3.5 w-3.5 items-center justify-center rounded-[3px]"
                      style={{ background: PROJECT_BLUE }}
                    >
                      <Check className="h-2 w-2 text-white" strokeWidth={4} />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-ink">{op.t}</span>
                    <span className="shrink-0 font-mono text-[10px] text-faint">→ {op.to}</span>
                  </div>
                ))}
                <div className="mt-2.5 flex items-center gap-2">
                  <span className="rounded-lg bg-ink px-3 py-1.5 text-[11px] font-bold text-background">
                    Apply 3
                  </span>
                  <span className="font-mono text-[9.5px] text-faint2">
                    nothing is saved until you do
                  </span>
                </div>
              </div>
            )}
      </div>
    </Frame>
  );
}

// ---------------------------------------------------------------------------
// 6 — your life in weeks · WATCH

// One square per week of the whole span — every week, not a sample: with a
// grid smaller than the lived count every square fills in, and the one square
// that matters (this week) never appears at all.
//
// Two years to a row rather than one. A row per year is the classic poster
// shape, but 85 rows of legible squares is taller than a laptop screen.
const LIFE_WEEKS = 4436;
const LIFE_COLS = 104;
const LIVED = 1521;

export function SceneLife({ p }: { p: number }) {
  const fill = ease(phase(p, 0.05, 0.62));
  const shown = Math.round(LIVED * fill);

  return (
    <Frame className="max-w-[620px]">
      <div className="mb-2.5 flex items-baseline gap-2">
        <span className="font-mono text-[22px] font-extrabold tabular-nums text-ink">
          {shown.toLocaleString()}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-widest text-faint2">
          weeks lived · 4,436 if you&apos;re lucky
        </span>
      </div>
      <div
        className="grid gap-[1.5px]"
        style={{ gridTemplateColumns: `repeat(${LIFE_COLS}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: LIFE_WEEKS }, (_, i) => {
          const lived = i < shown;
          const isNow = i === shown - 1;
          return (
            <span
              key={i}
              className={cn(
                "aspect-square rounded-[1px]",
                isNow && "animate-pulse ring-1 ring-[oklch(0.64_0.18_25)]"
              )}
              style={{
                background: isNow ? TASK_RED : lived ? "var(--muted)" : "var(--border2)",
              }}
            />
          );
        })}
      </div>
      <p className="m-0 mt-3 text-center text-[13px] font-semibold text-ink">
        The dark ones are spent. The red one is this week.
      </p>
    </Frame>
  );
}
