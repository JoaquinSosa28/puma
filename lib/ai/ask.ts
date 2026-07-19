// Server-only: answers a question about the user's data with structured gadgets.
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { buildUserSnapshot } from "@/lib/ai/user-snapshot";
import { ASK_CONTEXT } from "@/lib/ai/ask-context";
import { enrichAskAnswer } from "@/lib/ai/enrich-ask";
import { askAnswerSchema, type AskResult } from "@/lib/ai/ask-schema";
import { recordAiUsage } from "@/lib/ai/quota";
import { resolveAnthropicKey, NO_API_KEY_MESSAGE } from "@/lib/ai/api-key";

const DEFAULT_MODEL = "claude-haiku-4-5";

export async function ask(userId: string, question: string): Promise<AskResult> {
  const apiKey = await resolveAnthropicKey(userId);
  if (!apiKey) {
    throw new Error(NO_API_KEY_MESSAGE);
  }

  const { json, dataMode, data } = await buildUserSnapshot(userId);

  // Bounded latency (SDK default is 10 min); one retry for an interactive action.
  const client = new Anthropic({ apiKey, timeout: 60_000, maxRetries: 1 });
  const response = await client.messages.parse({
    model: process.env.ASSISTANT_MODEL ?? DEFAULT_MODEL,
    max_tokens: 8000,
    system: [
      // Static instructions marked cacheable; the volatile data block stays after
      // the breakpoint so it can't invalidate the cached prefix.
      { type: "text", text: ASK_CONTEXT, cache_control: { type: "ephemeral" } },
      { type: "text", text: `# The user's data (JSON)\n${json}` },
    ],
    messages: [{ role: "user", content: question }],
    output_config: { format: zodOutputFormat(askAnswerSchema) },
  });

  await recordAiUsage(userId, {
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  });

  if (response.stop_reason === "refusal") {
    throw new Error("The model declined to answer this request.");
  }
  if (response.stop_reason === "max_tokens") {
    throw new Error("The answer was too long. Try a more specific question.");
  }
  if (!response.parsed_output) {
    throw new Error("The model did not return a valid answer. Please try again.");
  }
  return { ...enrichAskAnswer(response.parsed_output, data), dataMode };
}
