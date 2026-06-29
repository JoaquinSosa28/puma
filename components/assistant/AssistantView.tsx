"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Topbar } from "@/components/shell/Topbar";
import { PlanGraph } from "@/components/assistant/PlanGraph";
import { AskDashboard } from "@/components/assistant/AskDashboard";
import { useAssistant } from "@/components/assistant/AssistantProvider";
import { applyPlan } from "@/lib/actions/assistant";
import { cn } from "@/lib/utils";

type Counts = { goals: number; projects: number; habits: number; tasks: number; notes: number };

type Props = {
  stats: { dayPct: number; habitsLabel: string; topStreak: number };
  birthDate?: string | null;
  lifeSpanYears?: number;
};

export function AssistantView({ stats, birthDate = null, lifeSpanYears }: Props) {
  const router = useRouter();
  const { kind, status, plan, ask, error, intent, clear } = useAssistant();
  const [applying, startApply] = useTransition();
  const [applied, setApplied] = useState<Counts | null>(null);

  // A fresh generation supersedes any previous "created" banner.
  useEffect(() => {
    if (status === "pending" || status === "ready") setApplied(null);
  }, [status]);

  const onApply = () => {
    if (!plan || applying) return;
    startApply(async () => {
      const res = await applyPlan(plan.plan);
      if (res.ok) {
        setApplied(res.data ?? null);
        clear();
        router.refresh();
      }
    });
  };

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
      <div className="min-h-0 flex-1 overflow-y-auto pb-6 animate-puma-view">
        {status === "ready" && kind === "plan" && plan ? (
          <>
            <div className="mb-4 flex items-start justify-between gap-3">
              <p className="text-[13px] text-muted">{plan.plan.summary}</p>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={clear}
                  disabled={applying}
                  className="rounded-md border border-border px-3 py-1.5 text-[13px] text-muted hover:border-faint2 disabled:opacity-50"
                >
                  Discard
                </button>
                <button
                  type="button"
                  onClick={onApply}
                  disabled={applying}
                  className="rounded-md bg-habits px-3.5 py-1.5 text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {applying ? "Creating…" : "Apply plan"}
                </button>
              </div>
            </div>
            <PlanGraph plan={plan.plan} existing={plan.existing} />
          </>
        ) : status === "ready" && kind === "ask" && ask ? (
          <>
            <div className="mb-4 flex items-start justify-between gap-3">
              {intent && (
                <p className="font-mono text-[11px] text-faint">“{intent}”</p>
              )}
              <button
                type="button"
                onClick={clear}
                className="shrink-0 rounded-md border border-border px-3 py-1.5 text-[13px] text-muted hover:border-faint2"
              >
                Clear
              </button>
            </div>
            <AskDashboard result={ask} />
          </>
        ) : status === "pending" ? (
          <CenterState
            icon
            title={kind === "ask" ? "Thinking…" : "Planning…"}
            body={intent ? `“${intent}”` : "Working on it."}
          />
        ) : status === "error" ? (
          <CenterState
            title="Couldn’t complete that"
            body={error ?? "Something went wrong. Try again from the bar above."}
            tone="error"
          />
        ) : (
          <CenterState
            icon
            title={applied ? "Plan applied" : "Plan or ask"}
            body={
              applied ? (
                <>
                  Created{" "}
                  <strong>
                    {applied.goals} goals, {applied.projects} projects,{" "}
                    {applied.habits} habits, {applied.tasks} tasks
                    {applied.notes ? `, ${applied.notes} notes` : ""}
                  </strong>
                  .{" "}
                  <button
                    type="button"
                    onClick={() => router.push("/goals")}
                    className="underline underline-offset-2 hover:text-goals"
                  >
                    View goals
                  </button>
                </>
              ) : (
                <>
                  Use the bar above: <strong>Plan</strong> an idea into goals,
                  projects &amp; tasks, or <strong>Ask</strong> a question about your
                  own data — the result appears here.
                </>
              )
            }
          />
        )}
      </div>
    </>
  );
}

function CenterState({
  title,
  body,
  icon,
  tone,
}: {
  title: string;
  body: React.ReactNode;
  icon?: boolean;
  tone?: "error";
}) {
  return (
    <div className="flex min-h-[260px] flex-col items-center justify-center text-center">
      {icon && (
        <Sparkles
          className={cn(
            "mb-3 h-7 w-7",
            tone === "error" ? "text-[oklch(0.64_0.18_25)]" : "text-primary"
          )}
        />
      )}
      <div
        className={cn(
          "text-[15px] font-semibold",
          tone === "error" && "text-[oklch(0.64_0.18_25)]"
        )}
      >
        {title}
      </div>
      <div className="mt-1 max-w-md text-[13px] text-muted">{body}</div>
    </div>
  );
}
