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

  const response = object.response;
  if (response.kind === "answer") {
    const { widgets, answer } = response;
    return {
      kind: "answer",
      answer: enrichAskAnswer({ answer, widgets }, data),
      dataMode,
    };
  }
  return {
    kind: "changeset",
    changeset: { summary: response.summary, ops: response.ops },
  };
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
        [
          "You are rewriting ONE SUBTREE of a draft changeset. Your ops REPLACE the subtree below wholesale — whatever you leave out ceases to exist.",
          "",
          "So: return the FULL subtree after the change, not just the new parts. That means the root node itself (first op, same refId as now unless the instruction says to split or remove it), then every child that should survive — unchanged ones included, copied as they are.",
          "Children must keep pointing at their parent through `parentRef`; a child whose parentRef is empty becomes a loose top-level node, which is almost never what the instruction meant.",
          "Keep refIds stable for ops that survive; mint new ones only for genuinely new ops.",
          "The scaffolding rule still applies: structure only, the user's words only.",
        ].join("\n"),
        `Original request: ${input.intent}`,
        `Other nodes in the draft (do not recreate these): ${input.context.join("; ") || "none"}`,
        `Current subtree (the root node is first):\n${JSON.stringify(input.subtree, null, 2)}`,
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
