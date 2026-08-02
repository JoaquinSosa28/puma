"use client";

// The unified assistant workspace: one input, and the result is either an
// answer (widgets) or a changeset (an editable canvas). See ChangesetCanvas
// for the editing half.
import { useState } from "react";
import Link from "next/link";
import { KeyRound } from "lucide-react";
import { Topbar } from "@/components/shell/Topbar";
import { AskDashboard } from "@/components/assistant/AskDashboard";
import { ChangesetCanvas } from "@/components/assistant/ChangesetCanvas";
import { useAssistant } from "@/components/assistant/AssistantProvider";
import { cn } from "@/lib/utils";

type Props = {
  stats: { dayPct: number; habitsLabel: string; topStreak: number };
  birthDate?: string | null;
  lifeSpanYears?: number;
  /** False when no usable AI key is configured for this account. */
  aiReady?: boolean;
};

const ASK_EXAMPLES = [
  "Where does my time go?",
  "Which projects are stalling?",
  "Am I getting better at finishing things?",
];

const BUILD_EXAMPLES = [
  "Set up a project for the kitchen renovation",
  "Merge my two reading projects",
  "Delete the habits I never do",
];

export function AssistantView({
  stats,
  birthDate = null,
  lifeSpanYears,
  aiReady = true,
}: Props) {
  const { status, outcome, error, intent, run, flipMode, clear } = useAssistant();

  return (
    <>
      <Topbar
        title="Assistant"
        dayPct={stats.dayPct}
        habitsLabel={stats.habitsLabel}
        topStreak={stats.topStreak}
        birthDate={birthDate}
        lifeSpanYears={lifeSpanYears}
      />
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-6 max-lg:pb-28 animate-puma-view">
        {!aiReady ? (
          <ApiKeyNeeded />
        ) : status === "pending" ? (
          <Thinking intent={intent} />
        ) : status === "error" ? (
          <ErrorState error={error} intent={intent} onRetry={() => intent && run(intent)} />
        ) : status === "ready" && outcome?.kind === "changeset" ? (
          <ChangesetCanvas
            key={intent ?? "changeset"}
            changeset={outcome.changeset}
            intent={intent ?? ""}
            onFlipMode={flipMode}
            onDiscard={clear}
          />
        ) : status === "ready" && outcome?.kind === "answer" ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="mb-2 flex items-center gap-2">
                  <span className="block h-2 w-2 bg-primary" />
                  <span className="font-mono text-[10px] uppercase tracking-widest text-faint2">
                    Answer
                  </span>
                </div>
                <p className="m-0 max-w-[60ch] text-[17px] font-semibold leading-snug tracking-tight text-ink">
                  {outcome.answer.answer}
                </p>
                {intent && (
                  <p className="m-0 mt-1.5 text-[13px] text-muted">
                    You asked: <span className="text-ink">“{intent}”</span>
                  </p>
                )}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <button
                  type="button"
                  onClick={flipMode}
                  className="text-[12.5px] text-muted underline underline-offset-2 hover:text-ink"
                >
                  I meant to build this
                </button>
                <button
                  type="button"
                  onClick={clear}
                  className="rounded-md border border-border px-3 py-1 text-[12.5px] text-muted hover:border-faint2"
                >
                  Clear
                </button>
              </div>
            </div>
            <AskDashboard
              result={{ ...outcome.answer, dataMode: outcome.dataMode }}
              hideAnswer
            />
          </div>
        ) : (
          <EmptyState onSubmit={run} />
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------

function EmptyState({ onSubmit }: { onSubmit: (text: string) => void }) {
  const [text, setText] = useState("");

  const submit = (value?: string) => {
    const t = (value ?? text).trim();
    if (t) onSubmit(t);
  };

  return (
    <div className="flex flex-1 flex-col px-4 pt-8">
      <div className="mx-auto w-full max-w-[560px] text-center">
        <span className="inline-grid h-9 w-9 place-items-center rounded-[9px] bg-primary font-mono text-[15px] font-extrabold text-white">
          A
        </span>
        <p className="m-0 mt-4 text-[20px] font-bold tracking-tight text-ink">
          Ask about your data, or describe what to build.
        </p>
        <p className="m-0 mt-2 text-[13.5px] leading-relaxed text-muted">
          I read what&apos;s already in PUMA. When you ask for structure I propose
          the shape — the words inside it stay yours.
        </p>
        <div className="mt-5 flex items-center gap-2.5 rounded-xl border-[1.5px] border-border bg-surface px-4 py-3 text-left shadow-[1px_1px_0_var(--shadow)] focus-within:border-primary">
          <span className="block h-2 w-2 shrink-0 bg-primary" />
          <input
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            placeholder="Ask anything, or describe something to set up…"
            className="min-w-0 flex-1 border-none bg-transparent text-[14px] text-ink outline-none placeholder:text-faint"
          />
          <kbd className="rounded-[5px] border border-border px-1.5 py-0.5 font-mono text-[10px] text-faint">
            ↵
          </kbd>
        </div>
      </div>

      <div className="mx-auto mt-7 grid w-full max-w-[640px] grid-cols-1 gap-6 sm:grid-cols-2">
        <ExampleColumn label="Ask" examples={ASK_EXAMPLES} onPick={submit} />
        <ExampleColumn label="Build" examples={BUILD_EXAMPLES} onPick={submit} accent />
      </div>
    </div>
  );
}

function ExampleColumn({
  label,
  examples,
  onPick,
  accent,
}: {
  label: string;
  examples: string[];
  onPick: (text: string) => void;
  accent?: boolean;
}) {
  return (
    <div>
      <p className="m-0 mb-2.5 font-mono text-[10px] uppercase tracking-widest text-faint2">
        {label}
      </p>
      <div className="flex flex-col gap-1.5">
        {examples.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => onPick(e)}
            className={cn(
              "rounded-full border bg-surface px-3 py-1.5 text-left text-[12.5px] text-muted hover:text-ink",
              accent ? "border-primary" : "border-border hover:border-faint2"
            )}
          >
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Honest checkpoints instead of a spinner; the mode resolves with the result. */
function Thinking({ intent }: { intent: string | null }) {
  return (
    <div className="flex flex-1 flex-col gap-5 px-4 pt-8">
      {intent && (
        <p className="m-0 text-[13px] text-muted">
          You asked: <span className="text-ink">“{intent}”</span>
        </p>
      )}
      <div className="flex flex-col gap-3">
        <span className="flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-wider text-muted">
          <Tick /> Reading your data
        </span>
        <span className="flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-wider text-muted">
          <span className="mx-0.5 block h-2 w-2 animate-pulse bg-primary" />
          Deciding: answer or changeset…
        </span>
      </div>
      <div className="flex max-w-xl flex-col gap-2 rounded-[13px] border border-border bg-surface p-4">
        <span className="font-mono text-[10px] uppercase tracking-widest text-faint2">
          Forming
        </span>
        {[0.9, 0.7, 0.5, 0.35].map((opacity, i) => (
          <div
            key={i}
            className={cn(
              "overflow-hidden rounded-[10px] border border-border bg-surface px-3 py-2.5",
              i > 0 && i < 3 && "ml-5"
            )}
            style={{ opacity }}
          >
            <span
              className="block h-2.5 rounded bg-hover"
              style={{ width: `${52 - i * 6}%` }}
            />
          </div>
        ))}
      </div>
      <p className="m-0 font-mono text-[10px] text-faint">usually 3–15s</p>
    </div>
  );
}

function Tick() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--habits)" strokeWidth="2" aria-hidden>
      <path d="M3 8.5 6.5 12 13 4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ErrorState({
  error,
  intent,
  onRetry,
}: {
  error: string | null;
  intent: string | null;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      <span className="mb-3 font-mono text-[10px] uppercase tracking-widest text-tasks">
        Couldn&apos;t complete that
      </span>
      <p className="m-0 max-w-md text-[15px] font-semibold text-ink">
        {error ?? "Something went wrong."}
      </p>
      <p className="m-0 mt-1.5 max-w-md text-[13px] text-muted">
        Nothing was changed.
      </p>
      <div className="mt-4 flex gap-2">
        {intent && (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-[9px] bg-ink px-3.5 py-2 text-[12.5px] font-bold text-background"
          >
            Retry
          </button>
        )}
        <Link
          href="/settings"
          className="rounded-[9px] border-[1.5px] border-border bg-surface px-3 py-2 text-[12.5px] font-semibold text-ink no-underline"
        >
          Check Settings
        </Link>
      </div>
    </div>
  );
}

/** Shown when the account has no usable AI key — the assistant can't run. */
function ApiKeyNeeded() {
  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center px-6 text-center">
      <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-surface2 text-primary">
        <KeyRound className="h-5 w-5" />
      </span>
      <div className="text-[15px] font-semibold text-ink">
        The assistant has no key to call.
      </div>
      <p className="mt-1.5 max-w-md text-[13px] leading-relaxed text-muted">
        Pick an AI provider and paste your own key — everything else in the app
        works without one; the assistant is the only part that doesn&apos;t.
      </p>
      <Link
        href="/settings"
        className="mt-4 inline-flex items-center gap-2 rounded-[10px] bg-ink px-4 py-2 text-[13px] font-bold text-background no-underline transition-opacity hover:opacity-90"
      >
        <KeyRound className="h-3.5 w-3.5" />
        Open Settings
      </Link>
    </div>
  );
}
