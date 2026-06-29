"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  useTransition,
} from "react";
import { interpretIntent, askAssistant } from "@/lib/actions/assistant";
import type { PlanResult } from "@/lib/ai/plan-schema";
import type { AskResult } from "@/lib/ai/ask-schema";

type Status = "idle" | "pending" | "ready" | "error";
type Kind = "plan" | "ask";

type AssistantState = {
  kind: Kind | null;
  status: Status;
  plan: PlanResult | null;
  ask: AskResult | null;
  error: string | null;
  intent: string | null;
};

type AssistantContextValue = AssistantState & {
  generatePlan: (intent: string) => void;
  askQuestion: (question: string) => void;
  clear: () => void;
};

const AssistantContext = createContext<AssistantContextValue | null>(null);

const IDLE: AssistantState = {
  kind: null,
  status: "idle",
  plan: null,
  ask: null,
  error: null,
  intent: null,
};

/**
 * Holds the assistant's transient state (a generated Plan or an Ask answer) so the
 * OmniBar (app layout) triggers it and the /assistant page renders it — neither
 * needs its own input. In-memory only; resets on full reload.
 */
export function AssistantProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AssistantState>(IDLE);
  const [, startTransition] = useTransition();

  const generatePlan = useCallback((intent: string) => {
    setState({ ...IDLE, kind: "plan", status: "pending", intent });
    startTransition(async () => {
      const res = await interpretIntent(intent);
      setState((s) =>
        s.kind === "plan" && s.intent === intent
          ? res.ok
            ? { ...s, status: "ready", plan: res.data ?? null }
            : { ...s, status: "error", error: res.error }
          : s
      );
    });
  }, []);

  const askQuestion = useCallback((question: string) => {
    setState({ ...IDLE, kind: "ask", status: "pending", intent: question });
    startTransition(async () => {
      const res = await askAssistant(question);
      setState((s) =>
        s.kind === "ask" && s.intent === question
          ? res.ok
            ? { ...s, status: "ready", ask: res.data ?? null }
            : { ...s, status: "error", error: res.error }
          : s
      );
    });
  }, []);

  const clear = useCallback(() => setState(IDLE), []);

  return (
    <AssistantContext.Provider
      value={{ ...state, generatePlan, askQuestion, clear }}
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
