// Server-only: the unified assistant call. One request, and the model commits
// to an answer or a changeset via the schema's discriminator.
import "server-only";
import { buildUserSnapshot } from "@/lib/ai/user-snapshot";
import { ASSISTANT_CONTEXT, modePin } from "@/lib/ai/assistant-context";
import { enrichAskAnswer } from "@/lib/ai/enrich-ask";
import type { AskAnswer } from "@/lib/ai/ask-schema";
import type { Changeset } from "@/lib/ai/changeset-schema";
import {
  assistantResponseSchema,
  type AssistantMode,
} from "@/lib/ai/assistant-schema";
import { generateStructured } from "@/lib/ai/generate";

export type AssistOutcome =
  | { kind: "answer"; answer: AskAnswer; dataMode: "full" | "trimmed" }
  | { kind: "changeset"; changeset: Changeset };

export async function assist(
  userId: string,
  text: string,
  mode: AssistantMode = "auto"
): Promise<AssistOutcome> {
  const { json, dataMode, data } = await buildUserSnapshot(userId);

  const { object } = await generateStructured({
    userId,
    schema: assistantResponseSchema,
    system: {
      cacheable: ASSISTANT_CONTEXT,
      volatile: `# The user's data (JSON)\n${json}`,
    },
    prompt: mode === "auto" ? text : text + modePin(mode),
    maxTokens: 16000,
    tooLongMessage:
      "The result was too large to generate. Try a shorter or more focused request.",
    refusalMessage: "The model declined this request.",
    invalidMessage: "The model did not return a usable result. Please try again.",
  });

  if (object.kind === "answer") {
    const { widgets, answer } = object;
    return {
      kind: "answer",
      answer: enrichAskAnswer({ answer, widgets }, data),
      dataMode,
    };
  }
  return { kind: "changeset", changeset: { summary: object.summary, ops: object.ops } };
}

/**
 * Rewrite one subtree of a draft changeset. The response replaces exactly the
 * ops passed in — the rest of the canvas is never part of the conversation, so
 * it cannot drift.
 */
export async function repromptSubtree(
  userId: string,
  input: {
    intent: string;
    instruction: string;
    subtree: Changeset["ops"];
    context: string[];
  }
): Promise<Changeset["ops"]> {
  const { changesetSchema } = await import("@/lib/ai/changeset-schema");
  const subtreeSchema = changesetSchema.pick({ ops: true });

  const { object } = await generateStructured({
    userId,
    schema: subtreeSchema,
    system: {
      cacheable: ASSISTANT_CONTEXT,
      volatile: [
        "# Node-scoped rewrite",
        "You are rewriting ONE SUBTREE of an existing draft changeset. Return ops that REPLACE the subtree below — nothing else. Keep refIds stable where an op survives; mint new refIds for new ops. The scaffolding rule applies: structure only, the user's words only.",
        `Original request: ${input.intent}`,
        `Other nodes in the draft (do not recreate these): ${input.context.join("; ") || "none"}`,
        `Current subtree:\n${JSON.stringify(input.subtree, null, 2)}`,
      ].join("\n\n"),
    },
    prompt: input.instruction,
    maxTokens: 8000,
    tooLongMessage: "The rewrite was too large. Try a smaller instruction.",
    refusalMessage: "The model declined this rewrite.",
    invalidMessage: "The model did not return a usable rewrite. Please try again.",
  });

  return object.ops;
}
