// The changeset half of the assistant: typed operations against the world
// that exists, not a description of a new one. Pure schema — no db/SDK
// imports, so the canvas (a Client Component) can share the types.
//
// Authored against zod/v4 like the other AI schemas.
import * as z from "zod/v4";

const lifeArea = z.enum(["personal", "work"]);
const entity = z.enum(["goal", "project", "habit", "task", "note"]);

/**
 * Field payloads per entity. Everything optional: a create fills what the
 * user's words justify and nothing more; an update names only what changes.
 */
const goalFields = z.object({
  title: z.string().nullable().optional(),
  lifeArea: lifeArea.nullable().optional(),
  targetDate: z.string().nullable().optional(),
});

const projectFields = z.object({
  title: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  lifeArea: lifeArea.nullable().optional(),
  /** refId of a created goal, or a real goal id. */
  goalRef: z.string().nullable().optional(),
});

const habitFields = z.object({
  name: z.string().nullable().optional(),
  frequency: z.enum(["daily", "weekly", "monthly"]).nullable().optional(),
  lifeArea: lifeArea.nullable().optional(),
  goalRefs: z.array(z.string()).nullable().optional(),
});

const taskFields = z.object({
  title: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  priority: z.enum(["low", "med", "high"]).nullable().optional(),
  due: z.string().nullable().optional(),
  lifeArea: lifeArea.nullable().optional(),
  /** refId of a created project, or a real project id. */
  projectRef: z.string().nullable().optional(),
  tagNames: z.array(z.string()).nullable().optional(),
});

const noteFields = z.object({
  title: z.string().nullable().optional(),
  /** Scaffolding rule: stays empty unless the user dictated content. */
  body: z.string().nullable().optional(),
  lifeArea: lifeArea.nullable().optional(),
  tagNames: z.array(z.string()).nullable().optional(),
});

const fieldsFor = z.object({
  goal: goalFields.nullable().optional(),
  project: projectFields.nullable().optional(),
  habit: habitFields.nullable().optional(),
  task: taskFields.nullable().optional(),
  note: noteFields.nullable().optional(),
});

export const createOpSchema = z.object({
  op: z.literal("create"),
  entity,
  /** Plan-local handle ("p1") so later ops can reference this creation. */
  refId: z.string(),
  fields: fieldsFor,
});

export const updateOpSchema = z.object({
  op: z.literal("update"),
  entity,
  /** The real id, from the context the model was shown. */
  id: z.string(),
  /** Display name, so the diff reads without a lookup. */
  label: z.string(),
  fields: fieldsFor,
  /**
   * The old values of exactly the fields being changed. This is what makes the
   * diff honest — the UI renders old → new from here, never from a re-fetch.
   */
  before: fieldsFor,
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

export type ChangeOp = z.infer<typeof changeOpSchema>;
export type CreateOp = z.infer<typeof createOpSchema>;
export type UpdateOp = z.infer<typeof updateOpSchema>;
export type DeleteOp = z.infer<typeof deleteOpSchema>;
export type Changeset = z.infer<typeof changesetSchema>;
export type ChangeEntity = z.infer<typeof entity>;
