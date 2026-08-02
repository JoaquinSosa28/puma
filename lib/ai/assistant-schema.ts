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
 */
export const assistantResponseSchema = z.object({ response: responseUnion });

export type AssistantResponse = z.infer<typeof responseUnion>;

/** The caller can pin a branch when the router guessed wrong ("I meant to…"). */
export type AssistantMode = "auto" | "answer" | "changeset";
