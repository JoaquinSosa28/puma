// The words that mean something to the capture bar rather than being labels.
//
// Typing "#high" sets the priority; it does not tag anything "high". Because
// they'd be indistinguishable once stored, these names can't be used as tags
// either — see isReservedTagName, which every create/rename path checks.

import type { OmniType } from "@/lib/types";
import { DATE_COMPLETIONS, isDateToken } from "@/lib/date-tokens";

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
 * Dates behind the same "#" as everything else.
 *
 * This used to be just today/tomorrow, on the grounds that chrono already read
 * "friday" out of plain prose. It did — but it made the date the one thing you
 * had to type differently from every other instruction, and a bare word can't
 * be completed. Now "#friday", "#25/12" and "#work" are all the same gesture,
 * and Tab finishes all three. Bare prose still parses, so nothing anyone has
 * in their fingers stopped working.
 */
// The completion list, not every spelling: offering "fri" and "friday" as
// separate candidates means Tab rotates between two names for the same day
// and never lands. Short forms still parse — see isDateToken below.
export const RESERVED_DATE = DATE_COMPLETIONS;

/** Every word the capture bar claims, for completion and for validation. */
export const RESERVED_WORDS: string[] = [
  ...Object.keys(RESERVED_TYPE),
  ...Object.keys(RESERVED_PRIORITY),
  ...Object.keys(RESERVED_MODE),
  ...DATE_COMPLETIONS,
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
  const w = name.trim().toLowerCase();
  // Numeric dates are a shape rather than a word, so the set can't hold them:
  // a tag called "4/8" would be eaten by the parser just as surely as one
  // called "friday".
  return RESERVED_SET.has(w) || isDateToken(w);
}
