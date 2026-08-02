// The changeset half of the assistant: typed operations against the world
// that exists, not a description of a new one. Pure schema — no db/SDK
// imports, so the canvas (a Client Component) can share the types.
//
// Shape constraints matter more than elegance here. Anthropic's structured-
// output grammar caps optional parameters (24) AND union-typed parameters,
// nullable included (16). So: no .optional(), no .nullable() — every field is
// required, and "not set" is a sentinel: "" for strings, [] for arrays, and an
// explicit "unset" member on enums. One flat fields block serves all five
// entities; which keys mean anything depends on the entity.
import * as z from "zod/v4";

const entity = z.enum(["goal", "project", "habit", "task", "note"]);

/**
 * The one fields block. "" / [] / "unset" mean "not set" on a create and
 * "unchanged" on an update.
 *
 * Per entity: `title` is a habit's name; `description` is a note's body;
 * `date` is a task's due or a goal's targetDate; `parentRef` files a task
 * into a project or a project under a goal.
 */
export const opFieldsSchema = z.object({
  title: z.string(),
  description: z.string(),
  lifeArea: z.enum(["personal", "work", "unset"]),
  priority: z.enum(["low", "med", "high", "unset"]),
  frequency: z.enum(["daily", "weekly", "monthly", "unset"]),
  /** "YYYY-MM-DD" or "". */
  date: z.string(),
  /** refId of a created op, or a real id from the snapshot. "" = none. */
  parentRef: z.string(),
  /** Habit → goals. */
  goalRefs: z.array(z.string()),
  tagNames: z.array(z.string()),
});

export const createOpSchema = z.object({
  op: z.literal("create"),
  entity,
  /** Plan-local handle ("p1") so later ops can reference this creation. */
  refId: z.string(),
  fields: opFieldsSchema,
});

export const updateOpSchema = z.object({
  op: z.literal("update"),
  entity,
  /** The real id, from the context the model was shown. */
  id: z.string(),
  /** Display name, so the diff reads without a lookup. */
  label: z.string(),
  fields: opFieldsSchema,
  /**
   * The old values of exactly the fields being changed — set keys mirror
   * `fields`, everything else stays at its sentinel. The UI renders old → new
   * from here, never from a re-fetch.
   */
  before: opFieldsSchema,
});

export const deleteOpSchema = z.object({
  op: z.literal("delete"),
  entity,
  id: z.string(),
  label: z.string(),
});

export const changeOpSchema = z.discriminatedUnion("op", [
  createOpSchema,
  updateOpSchema,
  deleteOpSchema,
]);

export const changesetSchema = z.object({
  /** One line, said to the user: what this draft is. */
  summary: z.string(),
  ops: z.array(changeOpSchema),
});

export type OpFields = z.infer<typeof opFieldsSchema>;
export type ChangeOp = z.infer<typeof changeOpSchema>;
export type CreateOp = z.infer<typeof createOpSchema>;
export type UpdateOp = z.infer<typeof updateOpSchema>;
export type DeleteOp = z.infer<typeof deleteOpSchema>;
export type Changeset = z.infer<typeof changesetSchema>;
export type ChangeEntity = z.infer<typeof entity>;

/** Whether a string field carries a value. */
export function isSet(value: string): boolean {
  return value !== "";
}

/** A fully-unset fields block — hand-made draft ops satisfy the model's schema. */
export function blankOpFields(): OpFields {
  return {
    title: "",
    description: "",
    lifeArea: "unset",
    priority: "unset",
    frequency: "unset",
    date: "",
    parentRef: "",
    goalRefs: [],
    tagNames: [],
  };
}
