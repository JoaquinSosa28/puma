// Server-only: calls Claude to turn an intent into a structured PlanGraph.
// The `server-only` guard ensures the Anthropic SDK can never leak into a
// Client Component bundle (see the data-layer client/server boundary).
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { listGoals } from "@/lib/db/goals";
import { listProjects } from "@/lib/db/projects";
import { DOMAIN_CONTEXT, formatExistingEntities } from "@/lib/ai/domain-context";
import { planSchema, type PlanResult } from "@/lib/ai/plan-schema";

const DEFAULT_MODEL = "claude-haiku-4-5";

export async function interpret(intent: string): Promise<PlanResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to .env.local to use the AI planner."
    );
  }

  const [goals, projects] = await Promise.all([listGoals(), listProjects()]);
  const existing = formatExistingEntities(goals, projects);

  const client = new Anthropic();
  const response = await client.messages.parse({
    model: process.env.ASSISTANT_MODEL ?? DEFAULT_MODEL,
    max_tokens: 16000,
    system: [
      { type: "text", text: DOMAIN_CONTEXT },
      { type: "text", text: existing },
    ],
    messages: [{ role: "user", content: intent }],
    output_config: { format: zodOutputFormat(planSchema) },
  });

  if (response.stop_reason === "refusal") {
    throw new Error("The model declined to generate a plan for this request.");
  }
  if (response.stop_reason === "max_tokens") {
    throw new Error(
      "The plan was too large to generate. Try a shorter or more focused intent."
    );
  }
  if (!response.parsed_output) {
    throw new Error("The model did not return a valid plan. Please try again.");
  }
  return {
    plan: response.parsed_output,
    existing: {
      goals: goals.map((g) => ({ id: g.id, title: g.title })),
      projects: projects.map((p) => ({ id: p.id, title: p.title })),
    },
  };
}
