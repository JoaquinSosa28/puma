"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  useTransition,
} from "react";
import { runAssistant } from "@/lib/actions/changeset";
import type { AssistOutcome } from "@/lib/ai/assist";
import type { AssistantMode } from "@/lib/ai/assistant-schema";

type Status = "idle" | "pending" | "ready" | "error";

type AssistantState = {
  status: Status;
  outcome: AssistOutcome | null;
  error: string | null;
  intent: string | null;
  /** The pin used for the in-flight/last call — "auto" unless the user corrected. */
  mode: AssistantMode;
};

type AssistantContextValue = AssistantState & {
  run: (text: string, mode?: AssistantMode) => void;
  /** Re-run the last intent pinned to the other branch ("I meant to…"). */
  flipMode: () => void;
  clear: () => void;
  /** Legacy entry points, kept for the omnibar's Plan/Ask buttons. */
  generatePlan: (intent: string) => void;
  askQuestion: (question: string) => void;
};

const AssistantContext = createContext<AssistantContextValue | null>(null);

const IDLE: AssistantState = {
  status: "idle",
  outcome: null,
  error: null,
  intent: null,
  mode: "auto",
};

/**
 * Holds the assistant's transient state so the omnibar (app layout) can
 * trigger it and the /assistant page renders it. In-memory only; a draft dies
 * with the tab, which is the deliberate persistence story.
 */
export function AssistantProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AssistantState>(IDLE);
  const [, startTransition] = useTransition();

  const run = useCallback((text: string, mode: AssistantMode = "auto") => {
    setState({ ...IDLE, status: "pending", intent: text, mode });
    startTransition(async () => {
      const res = await runAssistant(text, mode);
      setState((s) =>
        s.intent === text && s.mode === mode
          ? res.ok
            ? { ...s, status: "ready", outcome: res.data ?? null }
            : { ...s, status: "error", error: res.error }
          : s
      );
    });
  }, []);

  const flipMode = useCallback(() => {
    setState((s) => {
      if (!s.intent || !s.outcome) return s;
      const next: AssistantMode =
        s.outcome.kind === "answer" ? "changeset" : "answer";
      // run() from inside an updater would double-fire; schedule after.
      const intent = s.intent;
      queueMicrotask(() => run(intent, next));
      return s;
    });
  }, [run]);

  const clear = useCallback(() => setState(IDLE), []);

  const generatePlan = useCallback((intent: string) => run(intent, "changeset"), [run]);
  const askQuestion = useCallback((question: string) => run(question, "answer"), [run]);

  return (
    <AssistantContext.Provider
      value={{ ...state, run, flipMode, clear, generatePlan, askQuestion }}
    >
      {children}
    </AssistantContext.Provider>
  );
}

export function useAssistant(): AssistantContextValue {
  const v = useContext(AssistantContext);
  if (!v) throw new Error("useAssistant must be used within AssistantProvider");
  return v;
}
