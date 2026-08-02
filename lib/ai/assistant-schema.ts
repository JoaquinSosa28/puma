// The unified assistant response: one call, and the model commits to being
// either an answer or a changeset via the discriminator — it cannot hedge.
import * as z from "zod/v4";
import { askAnswerSchema } from "@/lib/ai/ask-schema";
import { changesetSchema } from "@/lib/ai/changeset-schema";

const responseUnion = z.discriminatedUnion("kind", [
  askAnswerSchema.extend({ kind: z.literal("answer") }),
  changesetSchema.extend({ kind: z.literal("changeset") }),
]);

/**
 * Wrapped in an object because a tool's input_schema must be type: "object"
 * at the root — a bare anyOf is rejected by the API.
 *
 * The refinement is load-bearing, not decoration: an update op with no fields
 * changes nothing, and in a merge it reads as "the work moved" when it didn't.
 * JSON Schema can't express "at least one key", so this is enforced at parse
 * time — which puts the model's own mistake into the retry prompt, where it
 * gets corrected. Saying it in prose alone did not hold.
 */
export const assistantResponseSchema = z
  .preprocess((raw) => {
    // Seen in the wild: the model nests the wrapper twice. Cheaper to accept
    // than to fail a whole generation over a redundant layer.
    const r = raw as { response?: { response?: unknown } } | null;
    if (r?.response && typeof r.response === "object" && "response" in r.response) {
      return { response: r.response.response };
    }
    return raw;
  }, z.object({ response: responseUnion }))
  .refine(
    (r) =>
      r.response.kind !== "changeset" ||
      r.response.ops.every(
        (op) => op.op !== "update" || Object.keys(op.fields).length > 0
      ),
    {
      message:
        "Every update op must set at least one field. To move a task into a project, set fields.parentRef to that project's id.",
    }
  );

export type AssistantResponse = z.infer<typeof responseUnion>;

/** The caller can pin a branch when the router guessed wrong ("I meant to…"). */
export type AssistantMode = "auto" | "answer" | "changeset";

/**
 * When the user pins a mode ("I meant to build this"), the other branch is
 * removed from the schema rather than argued against in the prompt. A model
 * that has already decided once will decide the same way again given the same
 * choice — so take the choice away.
 */
export const answerOnlySchema = z.object({
  response: askAnswerSchema.extend({ kind: z.literal("answer") }),
});

export const changesetOnlySchema = z.object({
  response: changesetSchema.extend({ kind: z.literal("changeset") }),
});

export function schemaForMode(mode: AssistantMode) {
  if (mode === "answer") return answerOnlySchema;
  if (mode === "changeset") return changesetOnlySchema;
  return assistantResponseSchema;
}
