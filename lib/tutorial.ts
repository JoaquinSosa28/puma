// The 60-second tour, as data.
//
// Every beat earns its place by teaching something a person would not work out
// on their own. Filters, delete buttons and the settings page are deliberately
// absent: they have labels, and a tutorial that reads labels out loud is the
// kind people skip. What's here instead is the stuff that makes PUMA PUMA —
// type-anywhere capture, tags as filing rather than labelling, and an
// assistant that proposes instead of doing.
//
// Timings are in this file so re-cutting the tour is editing one array.

export type BeatId =
  | "type"
  | "tab"
  | "tag"
  | "bulk"
  | "assistant"
  | "life";

export type Beat = {
  id: BeatId;
  /** The one line on screen. Short enough to read while the scene plays. */
  caption: string;
  /** Second line, quieter — the "so what". Optional. */
  sub?: string;
  ms: number;
};

export const BEATS: Beat[] = [
  {
    id: "type",
    caption: "Don't click anything. Just type.",
    sub: "Dates, #tags and !priority are read as you go.",
    ms: 10_000,
  },
  {
    id: "tab",
    caption: "Tab changes what you're making.",
    sub: "One bar for tasks, habits, goals, notes — and the assistant.",
    ms: 8_000,
  },
  {
    id: "tag",
    caption: "A tag isn't a label. It's where the thing lives.",
    sub: "Tag it with a project and it moves in. Work vs personal follows.",
    ms: 11_000,
  },
  {
    id: "bulk",
    caption: "Pick many. Change them all.",
    sub: "⌘-click to add, shift-click for a range.",
    ms: 9_000,
  },
  {
    id: "assistant",
    caption: "Ask it, or tell it.",
    sub: "It proposes. You edit. Nothing is saved until you say so.",
    ms: 12_000,
  },
  {
    id: "life",
    caption: "This is your life in weeks.",
    sub: "1,521 down. Spend the next one on purpose.",
    ms: 9_000,
  },
];

/** How long the whole thing runs, in ms. */
export function totalMs(beats: Beat[] = BEATS): number {
  return beats.reduce((sum, b) => sum + b.ms, 0);
}

/** Where a beat starts on the timeline, for the progress bar and for seeking. */
export function beatStartMs(index: number, beats: Beat[] = BEATS): number {
  return beats.slice(0, index).reduce((sum, b) => sum + b.ms, 0);
}

/**
 * The beat playing at `elapsed`, and how far through it we are (0–1).
 * Past the end it pins to the last beat at 1 rather than going undefined —
 * the closing frame should hold, not vanish.
 */
export function beatAt(
  elapsed: number,
  beats: Beat[] = BEATS
): { index: number; beat: Beat; progress: number } {
  let acc = 0;
  for (let i = 0; i < beats.length; i++) {
    const end = acc + beats[i].ms;
    if (elapsed < end) {
      return { index: i, beat: beats[i], progress: (elapsed - acc) / beats[i].ms };
    }
    acc = end;
  }
  const last = beats.length - 1;
  return { index: last, beat: beats[last], progress: 1 };
}

/**
 * Characters revealed so far when typing `text` over `ms`, given the beat's
 * progress. `startAt`/`endAt` bound the typing to part of the beat, so the
 * scene can hold on the finished line before moving on.
 */
export function typedChars(
  text: string,
  progress: number,
  startAt = 0,
  endAt = 1
): string {
  if (progress <= startAt) return "";
  if (progress >= endAt) return text;
  const t = (progress - startAt) / (endAt - startAt);
  return text.slice(0, Math.round(t * text.length));
}
