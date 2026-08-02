// The changeset half of the assistant: typed operations against the world
// that exists, not a description of a new one. Pure schema — no db/SDK
// imports, so the canvas (a Client Component) can share the types.
//
// Authored against zod/v4 like the other AI schemas.
import * as z from "zod/v4";

const lifeArea = z.enum(["personal", "work"]);
const entity = z.enum(["goal", "project", "habit", "task", "note"]);

/**
 * Field payloads per entity. Every key is REQUIRED but nullable: null means
 * "not set / no change". Optional keys are deliberately absent — Anthropic's
 * structured-output grammar caps optional parameters at 24, and a union this
 * wide blows straight past it. Required-nullable compiles to zero optionals.
 */
const goalFields = z.object({
  title: z.string().nullable(),
  lifeArea: lifeArea.nullable(),
  targetDate: z.string().nullable(),
});

const projectFields = z.object({
  title: z.string().nullable(),
  description: z.string().nullable(),
  lifeArea: lifeArea.nullable(),
  /** refId of a created goal, or a real goal id. */
  goalRef: z.string().nullable(),
});

const habitFields = z.object({
  name: z.string().nullable(),
  frequency: z.enum(["daily", "weekly", "monthly"]).nullable(),
  lifeArea: lifeArea.nullable(),
  goalRefs: z.array(z.string()).nullable(),
});

const taskFields = z.object({
  title: z.string().nullable(),
  description: z.string().nullable(),
  priority: z.enum(["low", "med", "high"]).nullable(),
  due: z.string().nullable(),
  lifeArea: lifeArea.nullable(),
  /** refId of a created project, or a real project id. */
  projectRef: z.string().nullable(),
  tagNames: z.array(z.string()).nullable(),
});

const noteFields = z.object({
  title: z.string().nullable(),
  /** Scaffolding rule: stays empty unless the user dictated content. */
  body: z.string().nullable(),
  lifeArea: lifeArea.nullable(),
  tagNames: z.array(z.string()).nullable(),
});

const fieldsFor = z.object({
  goal: goalFields.nullable(),
  project: projectFields.nullable(),
  habit: habitFields.nullable(),
  task: taskFields.nullable(),
  note: noteFields.nullable(),
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

export type GoalFields = z.infer<typeof goalFields>;
export type ProjectFields = z.infer<typeof projectFields>;
export type HabitFields = z.infer<typeof habitFields>;
export type TaskFields = z.infer<typeof taskFields>;
export type NoteFields = z.infer<typeof noteFields>;
export type FieldsFor = z.infer<typeof fieldsFor>;

/** A fully-null fields block — hand-made draft ops must satisfy the same schema the model does. */
export function blankFields(): FieldsFor {
  return { goal: null, project: null, habit: null, task: null, note: null };
}

/** Every key of one entity's block, all null — the base for client-side edits. */
export const BLANK_BLOCK = {
  goal: { title: null, lifeArea: null, targetDate: null } satisfies GoalFields,
  project: {
    title: null, description: null, lifeArea: null, goalRef: null,
  } satisfies ProjectFields,
  habit: {
    name: null, frequency: null, lifeArea: null, goalRefs: null,
  } satisfies HabitFields,
  task: {
    title: null, description: null, priority: null, due: null,
    lifeArea: null, projectRef: null, tagNames: null,
  } satisfies TaskFields,
  note: {
    title: null, body: null, lifeArea: null, tagNames: null,
  } satisfies NoteFields,
} as const;

export function blankTaskFields(projectRef: string | null): FieldsFor {
  return { ...blankFields(), task: { ...BLANK_BLOCK.task, projectRef } };
}
