// Pure schema for the "Ask" assistant: the AI answers a question about the user's
// own data and lays the answer out as a grid of gadgets. No db/SDK imports, so the
// client dashboard can import these types. Authored against zod/v4 for zodOutputFormat.
import * as z from "zod/v4";

// Grid width (columns) the AI assigns each gadget. Literal union avoids min/max,
// which structured outputs doesn't support.
const span = z.union([z.literal(1), z.literal(2), z.literal(3)]);

const textWidget = z.object({
  type: z.literal("text"),
  title: z.string(),
  span,
  body: z.string(),
});

const statWidget = z.object({
  type: z.literal("stat"),
  title: z.string(),
  span,
  value: z.string(), // string so "78%", "12 days", "3 / 8" all work
  label: z.string().nullable().optional(),
  hint: z.string().nullable().optional(),
});

const entityKind = z.enum(["task", "project", "goal", "habit", "note"]);

const focusFields = {
  entityKind: entityKind.nullable().optional(),
  entityId: z.string().nullable().optional(),
  href: z.string().nullable().optional(),
};

const barWidget = z.object({
  type: z.literal("bar"),
  title: z.string(),
  span,
  unit: z.string().nullable().optional(),
  series: z.array(
    z.object({
      label: z.string(),
      value: z.number(),
      ...focusFields,
    })
  ),
});

const listWidget = z.object({
  type: z.literal("list"),
  title: z.string(),
  span,
  items: z.array(
    z.object({
      label: z.string(),
      sublabel: z.string().nullable().optional(),
      ...focusFields,
    })
  ),
});

const calendarWidget = z.object({
  type: z.literal("calendar"),
  title: z.string(),
  span,
  month: z.string(), // "YYYY-MM"
  marks: z.array(
    z.object({
      date: z.string(), // "YYYY-MM-DD"
      intensity: z.number().nullable().optional(), // 0..1 shading
      label: z.string().nullable().optional(),
    })
  ),
});

const tableWidget = z.object({
  type: z.literal("table"),
  title: z.string(),
  span,
  columns: z.array(z.string()),
  rows: z.array(z.array(z.string())),
});

export const widgetSchema = z.discriminatedUnion("type", [
  textWidget,
  statWidget,
  barWidget,
  listWidget,
  calendarWidget,
  tableWidget,
]);

export const askAnswerSchema = z.object({
  answer: z.string(),
  widgets: z.array(widgetSchema),
});

export type Widget = z.infer<typeof widgetSchema>;
export type AskAnswer = z.infer<typeof askAnswerSchema>;

/** What the ask action returns: the model answer plus which data slice was sent. */
export type AskResult = AskAnswer & { dataMode: "full" | "trimmed" };
