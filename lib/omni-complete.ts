// Pure completion logic for the capture bar. No React, no DOM — the caller
// applies the result to the input.

/** Priority words the "!" prefix can complete to. */
export const PRIORITY_WORDS = ["high", "mid", "low"] as const;

export type OmniCompletion = {
  /** The whole text with the partial token completed. */
  text: string;
  /** Where the caret should land — end of the completed token. */
  caret: number;
  /** What it completed to, for anything that wants to show it. */
  completion: string;
};

/**
 * The partial "#tag" or "!prio" the caret is sitting at the end of.
 *
 * Only the token being typed is a candidate — completing something behind the
 * caret would rewrite text the user has moved on from.
 */
export function tokenAtCaret(
  text: string,
  caret: number
): { prefix: "#" | "!"; word: string; start: number } | null {
  const before = text.slice(0, caret);
  const match = before.match(/([#!])([a-z0-9-]*)$/i);
  if (!match) return null;
  return {
    prefix: match[1] as "#" | "!",
    word: match[2].toLowerCase(),
    start: caret - match[0].length,
  };
}

/**
 * Best completion for a partial word.
 *
 * Words starting with what you typed win over words merely containing it — "#ai"
 * should reach "ai-tools" before "open-ai". Within each group the longest
 * candidate wins, which is what makes "#game" land on "game-dev-ops" rather
 * than stopping at the shorter "game-design".
 */
export function bestCompletion(
  word: string,
  candidates: string[]
): string | null {
  if (!word) return null;
  const lower = word.toLowerCase();
  const pool = candidates.map((c) => c.toLowerCase());

  const longest = (list: string[]) =>
    list.length
      ? list.reduce((best, c) => (c.length > best.length ? c : best))
      : null;

  const starts = pool.filter((c) => c !== lower && c.startsWith(lower));
  if (starts.length) return longest(starts);

  const contains = pool.filter((c) => c !== lower && c.includes(lower));
  return longest(contains);
}

/**
 * Complete the token at the caret, or null when there's nothing to add.
 *
 * `tagNames` drives "#", the priority words drive "!".
 */
export function completeOmniToken(
  text: string,
  caret: number,
  tagNames: string[]
): OmniCompletion | null {
  const token = tokenAtCaret(text, caret);
  if (!token || !token.word) return null;

  const candidates =
    token.prefix === "#" ? tagNames : [...PRIORITY_WORDS];
  const completion = bestCompletion(token.word, candidates);
  if (!completion) return null;

  const head = text.slice(0, token.start);
  const tail = text.slice(caret);
  const completed = `${token.prefix}${completion}`;
  return {
    text: `${head}${completed}${tail}`,
    caret: token.start + completed.length,
    completion,
  };
}
