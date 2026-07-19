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
import { recordAiUsage } from "@/lib/ai/quota";
import { resolveAnthropicKey, NO_API_KEY_MESSAGE } from "@/lib/ai/api-key";

const DEFAULT_MODEL = "claude-haiku-4-5";

export async function interpret(userId: string, intent: string): Promise<PlanResult> {
  const apiKey = await resolveAnthropicKey(userId);
  if (!apiKey) {
    throw new Error(NO_API_KEY_MESSAGE);
  }

  const [goals, projects] = await Promise.all([listGoals(userId), listProjects(userId)]);
  const existing = formatExistingEntities(goals, projects);

  // Bounded latency: a stuck request should fail in ~1 min, not the SDK's
  // 10-minute default; one retry is plenty for an interactive action.
  const client = new Anthropic({ apiKey, timeout: 60_000, maxRetries: 1 });
  const response = await client.messages.parse({
    model: process.env.ASSISTANT_MODEL ?? DEFAULT_MODEL,
    max_tokens: 16000,
    system: [
      // Static block marked cacheable — repeat calls reuse the prefill once the
      // prompt exceeds the model's minimum cacheable size (silently no-op below it).
      { type: "text", text: DOMAIN_CONTEXT, cache_control: { type: "ephemeral" } },
      { type: "text", text: existing },
    ],
    messages: [{ role: "user", content: intent }],
    output_config: { format: zodOutputFormat(planSchema) },
  });

  await recordAiUsage(userId, {
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
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
