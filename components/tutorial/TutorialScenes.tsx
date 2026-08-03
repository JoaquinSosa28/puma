"use client";

// The stage. Each scene is a small, fake PUMA built from the same tokens as
// the real one — a simulation rather than a spotlight on the live UI, because
// the tour runs on a brand-new account where the live UI is six empty boxes.
// Nothing here talks to the server; it's a film, and it plays the same way
// every time.
import { Check, Minus, Sparkles, Tag as TagIcon } from "lucide-react";
import { typedChars } from "@/lib/tutorial";
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

// ---------------------------------------------------------------------------
// Shared furniture

function Frame({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "w-full max-w-[560px] rounded-[16px] border border-border bg-surface p-4 shadow-[0_18px_50px_rgba(0,0,0,0.22)]",
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

/** The capture bar, with the tokens PUMA recognises picked out as they land. */
function OmniLine({ text, pill, pillColor }: { text: string; pill: string; pillColor: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-[13px] border-2 border-ink bg-surface px-3.5 py-3">
      <span
        className="shrink-0 rounded-[7px] px-[9px] py-1 font-mono text-[11px] font-semibold lowercase text-background transition-colors duration-300"
        style={{ background: pillColor }}
      >
        {pill}
      </span>
      <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-ink">
        {tokenise(text)}
        <Caret />
      </span>
    </div>
  );
}

/** Colour the bits the parser treats specially — the point of the first beat. */
function tokenise(text: string) {
  return text.split(/(\s+)/).map((word, i) => {
    if (word.startsWith("#")) {
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
    if (word.startsWith("!")) {
      return (
        <span key={i} className="font-mono text-[13px]" style={{ color: TASK_RED }}>
          {word}
        </span>
      );
    }
    if (/^(friday|today|tomorrow|monday)$/i.test(word)) {
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
  dim,
}: {
  title: string;
  accent: string;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
  dim?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-lg border border-border2 bg-surface px-3 py-2.5",
        dim && "opacity-45",
        className
      )}
      style={{ borderLeft: `3px solid ${accent}`, ...style }}
    >
      {children}
      <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-ink">
        {title}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 1 — type anywhere

export function SceneType({ p }: { p: number }) {
  const line = typedChars("pay rent friday #finance !high", p, 0.08, 0.62);
  const landed = p > 0.72;
  return (
    <Frame>
      <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-faint2">
        <span className="flex gap-1">
          {["p", "a", "y"].map((k, i) => (
            <kbd
              key={k}
              className="rounded border border-border bg-surface2 px-1.5 py-0.5 text-[10px] text-ink transition-opacity"
              style={{ opacity: p > 0.05 + i * 0.04 ? 1 : 0.2 }}
            >
              {k}
            </kbd>
          ))}
        </span>
        no field focused — it just goes in
      </div>
      <OmniLine text={line} pill="task" pillColor={TASK_RED} />
      <div className="mt-3 min-h-[46px]">
        {landed && (
          <Row
            title="pay rent"
            accent={TASK_RED}
            className="tutorial-in"
          >
            <span className="h-4 w-4 shrink-0 rounded-[5px] border-[1.8px] border-border" />
            <span
              className="shrink-0 rounded-md px-1.5 py-px font-mono text-[9px] font-bold"
              style={{ color: TASK_RED, background: "oklch(0.64 0.18 25 / 0.12)" }}
            >
              HIGH
            </span>
            <span className="order-last shrink-0 font-mono text-[10px] text-faint">
              Fri
            </span>
            <span
              className="order-last shrink-0 rounded-[5px] px-[6px] py-px font-mono text-[10px]"
              style={{ color: FINANCE_AMBER, background: "oklch(0.7 0.12 70 / 0.14)" }}
            >
              finance
            </span>
          </Row>
        )}
      </div>
    </Frame>
  );
}

// ---------------------------------------------------------------------------
// 2 — Tab cycles what you're making

const TYPES = [
  { label: "task", color: TASK_RED, hint: "pay rent friday" },
  { label: "habit", color: HABIT_GREEN, hint: "read 20 min daily" },
  { label: "goal", color: GOAL_PURPLE, hint: "run a half marathon" },
  { label: "note", color: "var(--ink)", hint: "kitchen quotes" },
  { label: "assistant", color: "var(--primary)", hint: "where did my time go?" },
];

export function SceneTab({ p }: { p: number }) {
  const i = Math.min(TYPES.length - 1, Math.floor(p * TYPES.length * 0.98));
  const current = TYPES[i];
  return (
    <Frame>
      <div className="mb-3 flex items-center gap-2">
        <kbd className="rounded border border-border bg-surface2 px-2 py-1 font-mono text-[11px] font-bold text-ink">
          Tab
        </kbd>
        <span className="font-mono text-[10px] uppercase tracking-widest text-faint2">
          again · and again
        </span>
      </div>
      <OmniLine text={current.hint} pill={current.label} pillColor={current.color} />
      <div className="mt-3.5 flex flex-wrap gap-1.5">
        {TYPES.map((t, idx) => (
          <span
            key={t.label}
            className={cn(
              "rounded-lg border px-2.5 py-1 font-mono text-[11px] transition-all duration-300",
              idx === i
                ? "border-2 font-bold text-background"
                : "border-border bg-surface2 text-faint2"
            )}
            style={idx === i ? { background: t.color, borderColor: t.color } : undefined}
          >
            {t.label}
          </span>
        ))}
      </div>
    </Frame>
  );
}

// ---------------------------------------------------------------------------
// 3 — a tag is where the thing lives

export function SceneTag({ p }: { p: number }) {
  const menuOpen = p > 0.12 && p < 0.62;
  const picked = p > 0.42;
  const flight = ease(phase(p, 0.5, 0.78));
  const landed = p > 0.72;

  return (
    <Frame>
      <div className="grid grid-cols-1 items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
        {/* Where it starts: loose, personal */}
        <div>
          <p className="m-0 mb-1.5 font-mono text-[9.5px] uppercase tracking-widest text-faint2">
            No project
          </p>
          <div className="relative">
            <Row
              title="Build hero section"
              accent={landed ? "var(--border)" : TASK_RED}
              dim={landed}
              style={{
                transform: `translateX(${flight * 40}px)`,
                opacity: landed ? 0.25 : 1 - flight * 0.5,
              }}
            >
              <span className="h-4 w-4 shrink-0 rounded-[5px] border-[1.8px] border-border" />
            </Row>
            {menuOpen && (
              <div className="tutorial-in absolute left-6 top-[calc(100%+6px)] z-10 w-[168px] rounded-lg border border-border bg-surface p-1 shadow-lg">
                <p className="m-0 px-1.5 pb-1 pt-0.5 font-mono text-[9px] tracking-widest text-faint2">
                  TAG
                </p>
                {[
                  { name: "website-redesign", color: PROJECT_BLUE, project: true },
                  { name: "health", color: HABIT_GREEN },
                ].map((t) => (
                  <span
                    key={t.name}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-1.5 py-1 text-[11.5px]",
                      t.project && picked ? "bg-hover font-semibold text-ink" : "text-muted"
                    )}
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: t.color }}
                    />
                    <span className="min-w-0 flex-1 truncate">{t.name}</span>
                    {t.project && picked && (
                      <Check className="h-3 w-3 shrink-0 text-primary" strokeWidth={3} />
                    )}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <TagIcon
          className="mx-auto h-4 w-4 shrink-0 rotate-90 text-faint2 transition-transform duration-500 sm:mx-0 sm:rotate-0"
          style={{ opacity: 0.4 + flight * 0.6 }}
        />

        {/* Where it ends up: inside the project, and now work */}
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
          className="rounded-[5px] px-2 py-0.5 transition-all duration-500"
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
          className="rounded-[5px] px-2 py-0.5 transition-all duration-500"
          style={
            landed
              ? { color: PROJECT_BLUE, background: "oklch(0.58 0.14 245 / 0.16)" }
              : { color: "var(--faint2)", background: "var(--surface2)" }
          }
        >
          work
        </span>
      </div>
    </Frame>
  );
}

// ---------------------------------------------------------------------------
// 4 — pick many, change them all

const BULK_ROWS = [
  "Draft launch email",
  "Send invoice to client",
  "Pay rent",
  "Build hero section",
  "Call Mom",
];

export function SceneBulk({ p }: { p: number }) {
  // One with cmd, then a range with shift, then the panel does its work.
  const first = p > 0.1 ? 1 : 0;
  const ranged = p > 0.3 ? BULK_ROWS.length : first;
  const applied = p > 0.62;

  return (
    <Frame>
      {/* Side by side has no room on a phone — the panel would hang off
          the frame — so it drops underneath instead. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_150px]">
        <div className="flex flex-col gap-1.5">
          {BULK_ROWS.map((title, i) => {
            const picked = i < ranged;
            return (
              <Row
                key={title}
                title={title}
                accent={picked ? "var(--primary)" : TASK_RED}
                className={cn(
                  "transition-all duration-300",
                  picked && "bg-primary/[0.10] ring-1 ring-inset ring-primary/40"
                )}
              >
                <span
                  className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border-[1.8px] transition-colors duration-200",
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
          })}
        </div>

        <div className="rounded-lg border border-border bg-surface2/40 p-2.5">
          <p className="m-0 text-[13px] font-bold text-ink">
            {ranged} <span className="text-[11px] font-semibold">selected</span>
          </p>
          <p className="m-0 mt-1 font-mono text-[9px] leading-relaxed text-faint2">
            ⌘-click · shift-click
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
          <p className="m-0 mt-2.5 font-mono text-[9px] uppercase tracking-widest text-faint2">
            Tags
          </p>
          <div className="mt-1 flex flex-wrap gap-1">
            {[
              { n: "work", s: "some" },
              { n: "idea", s: "none" },
            ].map((t) => (
              <span
                key={t.n}
                className="flex items-center gap-1 rounded-md border border-border bg-surface px-1.5 py-0.5 font-mono text-[9.5px] text-muted"
              >
                <span className="flex h-2.5 w-2.5 items-center justify-center rounded-[2px] border border-faint2">
                  {t.s === "some" && (
                    <Minus className="h-1.5 w-1.5 text-faint" strokeWidth={5} />
                  )}
                </span>
                {t.n}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Frame>
  );
}

// ---------------------------------------------------------------------------
// 5 — ask it, or tell it

const SLICES = [
  { label: "Website redesign", value: 42, color: PROJECT_BLUE },
  { label: "Side app MVP", value: 28, color: GOAL_PURPLE },
  { label: "Admin", value: 18, color: HABIT_GREEN },
  { label: "Unfiled", value: 12, color: FINANCE_AMBER },
];

export function SceneAssistant({ p }: { p: number }) {
  // First half asks a question and draws the answer; second half gives an
  // instruction and shows the draft it proposes instead of just doing it.
  const asking = p < 0.5;
  const q = typedChars("where did my time go?", p, 0.02, 0.16);
  const cmd = typedChars("file my unfiled tasks", p, 0.5, 0.63);
  const chartIn = ease(phase(p, 0.2, 0.42));
  const draftIn = phase(p, 0.66, 0.84);

  let offset = 25;
  const arcs = SLICES.map((s) => {
    const pct = s.value;
    const arc = { ...s, pct, offset };
    offset -= pct;
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
        {asking ? (
          chartIn > 0 && (
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
                    <i
                      className="h-2 w-2 shrink-0 rounded-[2px]"
                      style={{ background: a.color }}
                    />
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
        ) : (
          draftIn > 0 && (
            <div
              className="rounded-lg border border-border bg-surface p-3"
              style={{ opacity: draftIn }}
            >
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
                  <span className="shrink-0 font-mono text-[10px] text-faint">
                    → {op.to}
                  </span>
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
          )
        )}
      </div>
    </Frame>
  );
}

// ---------------------------------------------------------------------------
// 6 — your life in weeks

// One square per week of the whole span — every week, not a sample: with a
// grid smaller than the lived count every square fills in, and the one square
// that matters (this week) never appears at all.
//
// Two years to a row rather than one. A row per year is the classic poster
// shape, but 85 rows of legible squares is taller than a laptop screen, and
// the frame ends up centred with its middle off both edges.
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
                background: isNow
                  ? TASK_RED
                  : lived
                    ? "var(--muted)"
                    : "var(--border2)",
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
