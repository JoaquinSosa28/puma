// The words that mean something to the capture bar rather than being labels.
//
// Typing "#high" sets the priority; it does not tag anything "high". Because
// they'd be indistinguishable once stored, these names can't be used as tags
// either — see isReservedTagName, which every create/rename path checks.

import type { OmniType } from "@/lib/types";

/** "#high buy milk" — same three levels the picker offers. */
export const RESERVED_PRIORITY: Record<string, "low" | "med" | "high"> = {
  high: "high",
  mid: "med",
  med: "med",
  low: "low",
};

/** "#note ideas for later" switches what's being captured. */
export const RESERVED_TYPE: Record<string, OmniType> = {
  task: "task",
  habit: "habit",
  goal: "goal",
  note: "note",
};

/** "#ask what's overdue" switches the bar out of capture mode. */
export const RESERVED_MODE: Record<string, "plan" | "ask"> = {
  plan: "plan",
  ask: "ask",
};

/**
 * Relative days that read naturally with a "#".
 *
 * Deliberately short: chrono already understands "friday", "next week" and
 * "aug 4" from plain text, so this only covers the two the quick-pick offers
 * as buttons. Adding more would mean maintaining a date vocabulary that the
 * parser already handles better without a prefix.
 */
export const RESERVED_DATE = ["today", "tomorrow"] as const;

/** Every word the capture bar claims, for completion and for validation. */
export const RESERVED_WORDS: string[] = [
  ...Object.keys(RESERVED_PRIORITY),
  ...Object.keys(RESERVED_TYPE),
  ...Object.keys(RESERVED_MODE),
  ...RESERVED_DATE,
];

const RESERVED_SET = new Set(RESERVED_WORDS);

/**
 * Whether a name is off-limits as a tag.
 *
 * A tag called "high" would be silently eaten by the parser every time it was
 * typed, so the honest thing is to refuse it at creation rather than let
 * someone build a workflow on a name that can't survive a round trip.
 */
export function isReservedTagName(name: string): boolean {
  return RESERVED_SET.has(name.trim().toLowerCase());
}
