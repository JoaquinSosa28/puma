// Server-only: answers a question about the user's data with structured gadgets.
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { buildUserSnapshot } from "@/lib/ai/user-snapshot";
import { ASK_CONTEXT } from "@/lib/ai/ask-context";
import { enrichAskAnswer } from "@/lib/ai/enrich-ask";
import { askAnswerSchema, type AskResult } from "@/lib/ai/ask-schema";

const DEFAULT_MODEL = "claude-haiku-4-5";

export async function ask(question: string): Promise<AskResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to .env.local to use the assistant."
    );
  }

  const { json, dataMode, data } = await buildUserSnapshot();

  const client = new Anthropic();
  const response = await client.messages.parse({
    model: process.env.ASSISTANT_MODEL ?? DEFAULT_MODEL,
    max_tokens: 8000,
    system: [
      { type: "text", text: ASK_CONTEXT },
      { type: "text", text: `# The user's data (JSON)\n${json}` },
    ],
    messages: [{ role: "user", content: question }],
    output_config: { format: zodOutputFormat(askAnswerSchema) },
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
