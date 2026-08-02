// Multi-select over a list of tasks: ctrl/cmd-click picks individuals,
// shift-click takes everything between the anchor and the click. The rules are
// pure and live here so both the tasks list and the kanban board behave the
// same way, and so the fiddly parts (a range with no anchor, an anchor that
// has since been filtered out of view) are testable without a DOM.

/** What a click means, given which modifiers were held. */
export type SelectIntent =
  /** No modifier — not a selection gesture at all; the caller opens the task. */
  | "open"
  /** ctrl/cmd — add or remove this one. */
  | "toggle"
  /** shift — everything from the anchor to here, replacing the selection. */
  | "range"
  /** ctrl/cmd + shift — the same range, added to what's already selected. */
  | "rangeAdd";

export type SelectionState = {
  /** Selected ids, always in the list's own order. */
  ids: string[];
  /** Where a shift-range measures from. */
  anchor: string | null;
};

export const EMPTY_SELECTION: SelectionState = { ids: [], anchor: null };

/** Read the modifiers off a click. metaKey is cmd on a Mac, ctrlKey elsewhere. */
export function intentFor(e: {
  metaKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
}): SelectIntent {
  const multi = Boolean(e.metaKey || e.ctrlKey);
  if (e.shiftKey) return multi ? "rangeAdd" : "range";
  return multi ? "toggle" : "open";
}

/** Ids between two entries of `order`, inclusive, whichever way round they are. */
function span(order: string[], from: string, to: string): string[] {
  const a = order.indexOf(from);
  const b = order.indexOf(to);
  if (a < 0 || b < 0) return [];
  return order.slice(Math.min(a, b), Math.max(a, b) + 1);
}

/** Keep a selection in the list's order, so the panel and the rows agree. */
function ordered(order: string[], ids: Iterable<string>): string[] {
  const wanted = new Set(ids);
  return order.filter((id) => wanted.has(id));
}

/**
 * The next selection after clicking `id`.
 *
 * `order` is the ids as currently rendered, top to bottom — filtering, sorting
 * and grouping have already been applied, so a shift-range covers what the
 * user can actually see rather than some underlying order they can't.
 */
export function reduceSelection(
  state: SelectionState,
  order: string[],
  id: string,
  intent: SelectIntent
): SelectionState {
  if (intent === "open") return EMPTY_SELECTION;

  if (intent === "toggle") {
    const has = state.ids.includes(id);
    const next = has
      ? state.ids.filter((x) => x !== id)
      : ordered(order, [...state.ids, id]);
    // Deselecting the anchor leaves the next range measuring from this click,
    // which is where the user's attention is anyway.
    return { ids: next, anchor: id };
  }

  // A range needs somewhere to measure from. Without a live anchor — first
  // click of the session, or the anchor scrolled out of the current filter —
  // this click becomes the anchor and selects only itself.
  const anchor = state.anchor && order.includes(state.anchor) ? state.anchor : null;
  if (!anchor) return { ids: [id], anchor: id };

  const range = span(order, anchor, id);
  if (!range.length) return { ids: [id], anchor: id };

  const ids =
    intent === "rangeAdd" ? ordered(order, [...state.ids, ...range]) : range;
  // The anchor stays put so you can keep extending or shrinking the same
  // range with repeated shift-clicks.
  return { ids, anchor };
}

/**
 * Drop ids that are no longer in the list. Rows disappear when a filter
 * changes or another device deletes something, and a selection that outlives
 * its rows shows a count for tasks nobody can see.
 */
export function pruneSelection(
  state: SelectionState,
  order: string[]
): SelectionState {
  const live = new Set(order);
  if (state.ids.every((id) => live.has(id))) return state;
  return {
    ids: state.ids.filter((id) => live.has(id)),
    anchor: state.anchor && live.has(state.anchor) ? state.anchor : null,
  };
}
