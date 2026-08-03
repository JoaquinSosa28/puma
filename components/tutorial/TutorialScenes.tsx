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
import { checkCapture, nextHold, typedChars } from "@/lib/tutorial";
import {
  reduceSelection,
  type SelectionState,
} from "@/lib/task-selection";
import { TokenChecks } from "@/components/tutorial/TutorialChrome";
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

/** Missions report completion once; the overlay handles moving on. */
export type SceneProps = { onDone: () => void; done: boolean };

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
// A real input, focused on arrival, parsing the same three tokens the real bar
// does. Typing "pay rent friday #finance" here is the same motion as typing it
// for real tomorrow.

export function SceneType({ onDone, done }: SceneProps) {
  const [text, setText] = useState("");
  const [captured, setCaptured] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const checks = checkCapture(text);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = () => {
    if (!checks.ok) {
      // Refusing silently would read as a broken tutorial; the chips below
      // already say which of the three parts is missing.
      setShake(true);
      window.setTimeout(() => setShake(false), 400);
      return;
    }
    setCaptured(text);
    setText("");
    onDone();
  };

  return (
    <Frame glow={!done}>
      <div className="mb-3 font-mono text-[10px] uppercase tracking-widest text-faint2">
        no field focused — it just goes in
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
        {/* The real value lives in a transparent input laid over the coloured
            copy of it, so tokens can light up while you're typing them. */}
        <div className="relative min-w-0 flex-1">
          <div className="pointer-events-none truncate text-[15px] font-medium text-ink">
            {text ? tokenise(text) : <span className="text-faint2">pay rent friday #finance</span>}
            {!done && <Caret />}
          </div>
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
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
        <kbd className="shrink-0 rounded border border-border bg-surface2 px-1.5 py-0.5 font-mono text-[10px] text-faint">
          ↵
        </kbd>
      </div>

      <TokenChecks
        checks={[
          { label: "a title", ok: checks.hasTitle },
          { label: "a day", ok: checks.hasDay },
          { label: "a #tag", ok: checks.hasTag },
        ]}
      />

      <div className="mt-3 min-h-[46px]">
        {captured && (
          <Row
            title={captured.replace(/#[a-z0-9-]+/gi, "").replace(/\s+/g, " ").trim()}
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
export function SceneTab({ onDone, done }: SceneProps) {
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
      setI((prev) => (prev + (e.shiftKey ? -1 : 1) + TYPES.length) % TYPES.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [done]);

  // The meter. Runs continuously so leaving drains it, rather than only
  // ticking while you happen to be in the right place.
  useEffect(() => {
    if (done) return;
    let last = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const dt = Math.min(now - last, 100);
      last = now;
      setHold((h) => nextHold(h, onTarget, dt));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [onTarget, done]);

  useEffect(() => {
    if (reported.current || done || hold < 1) return;
    reported.current = true;
    onDone();
  }, [hold, done, onDone]);

  const current = TYPES[i];

  return (
    <Frame glow={!done}>
      {/* The instruction, as the key itself. Nobody reads "press Tab"; they
          look at a picture of the key. */}
      <div className="mb-4 flex flex-col items-center gap-2">
        <div className="flex items-center gap-2">
          <KeyCap label="⇧ shift" pressed={presses} />
          <span className="font-mono text-[11px] text-faint2">+</span>
          <span className={cn(!presses && "tutorial-nudge-soft")}>
            <KeyCap label="⇥ Tab" pressed={presses} wide big />
          </span>
        </div>
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
export function SceneTabTouch({ onDone, done }: SceneProps) {
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
            onClick={() => setI(idx)}
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

export function SceneTag({ onDone, done }: SceneProps) {
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
    setMenu(null);
    // The other tag is a label, not a place — picking it files nothing, which
    // is the distinction this beat is about.
    if (!project) return;
    setPicked(true);
    window.setTimeout(onDone, 900);
  };

  const landed = picked || done;

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
              className={cn("cursor-context-menu select-none", !done && "tutorial-nudge")}
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

function BulkPanel({
  count,
  applied,
  previewing,
}: {
  count: number;
  applied: boolean;
  previewing?: boolean;
}) {
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
        {previewing ? "release to take them" : "shift-click a range"}
      </p>
      <p className="m-0 mt-2.5 font-mono text-[9px] uppercase tracking-widest text-faint2">
        Priority
      </p>
      <div className="mt-1 flex gap-1">
        {["Low", "Mid", "High"].map((l) => (
          <span
            key={l}
            className={cn(
              "flex-1 rounded-md border py-1 text-center font-mono text-[9px] font-bold uppercase transition-all duration-300",
              applied && l === "High"
                ? "border-2 text-ink"
                : "border-border bg-surface text-faint2"
            )}
            style={
              applied && l === "High"
                ? { borderColor: TASK_RED, background: "oklch(0.64 0.18 25 / 0.12)" }
                : undefined
            }
          >
            {l}
          </span>
        ))}
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
        {applied && picked ? "HIGH" : "MID"}
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
export function SceneBulk({ onDone, done }: SceneProps) {
  const order = useMemo(() => BULK_ROWS.map((_, i) => `r${i}`), []);
  // Row 0 is handed to you — the mission is the second half of the gesture.
  const [sel, setSel] = useState<SelectionState>({ ids: ["r0"], anchor: "r0" });
  const [hover, setHover] = useState<number | null>(null);
  const [applied, setApplied] = useState(false);
  const [wrongClick, setWrongClick] = useState(false);
  const reported = useRef(false);

  useEffect(() => {
    if (reported.current || done || sel.ids.length < 2) return;
    reported.current = true;
    setApplied(true);
    const t = window.setTimeout(onDone, 950);
    return () => window.clearTimeout(t);
  }, [sel.ids.length, done, onDone]);

  const click = (index: number, e: React.MouseEvent) => {
    if (done || reported.current) return;
    // Only shift. A plain or ⌘ click would start a different selection and
    // quietly undo the half of the gesture the tour set up.
    if (!e.shiftKey || index === 0) {
      setWrongClick(true);
      window.setTimeout(() => setWrongClick(false), 450);
      return;
    }
    window.getSelection?.()?.removeAllRanges();
    setSel((s) => reduceSelection(s, order, order[index], "range"));
  };

  // What a shift-click right now would take — drawn before it's committed.
  const preview = hover !== null && hover > 0 && !applied ? hover : null;

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
            ? "shift. hold shift, then click."
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
  const ROW = 44;
  const GAP = 6;
  const top = ROW / 2;
  const height = rows * (ROW + GAP);
  return (
    <svg
      className="pointer-events-none absolute -left-1 top-0 z-10 overflow-visible"
      width="18"
      height={top + height}
      aria-hidden
    >
      <defs>
        <marker id="tut-arrow" markerWidth="7" markerHeight="7" refX="3.5" refY="3.5" orient="auto">
          <path d="M0,0 L7,3.5 L0,7 z" fill="var(--primary)" />
        </marker>
      </defs>
      <line
        x1="9"
        y1={top}
        x2="9"
        y2={top + height - 9}
        stroke="var(--primary)"
        strokeWidth="2"
        strokeLinecap="round"
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
