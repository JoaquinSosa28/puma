// Pure completion logic for the capture bar. No React, no DOM — the caller
// applies the result to the input.

/** Priority words the "!" prefix can complete to. */
export const PRIORITY_WORDS = ["high", "mid", "low"] as const;

export type OmniCompletion = {
  /** The whole text with the partial token completed. */
  text: string;
  /** Where the caret should land. */
  caret: number;
  /** What the token now reads as. */
  completion: string;
  /** True when one candidate remained and the token is finished. */
  exact: boolean;
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

/** Everything that could still be meant by what's been typed. */
export function candidatesFor(word: string, pool: string[]): string[] {
  const lower = word.toLowerCase();
  const names = pool.map((c) => c.toLowerCase());
  const starts = names.filter((c) => c.startsWith(lower));
  // Only fall back to substring matches when nothing starts with it, so
  // "#art" doesn't drag in "smart-home" while a real prefix match exists.
  return starts.length ? starts : names.filter((c) => c.includes(lower));
}

/**
 * The longest prefix every candidate shares — how a shell completes.
 *
 * With "website-app" and "website-site" this returns "website-", which is
 * genuinely known, rather than guessing one of them.
 */
export function commonPrefix(words: string[]): string {
  if (!words.length) return "";
  let prefix = words[0];
  for (const word of words.slice(1)) {
    let i = 0;
    while (i < prefix.length && i < word.length && prefix[i] === word[i]) i++;
    prefix = prefix.slice(0, i);
    if (!prefix) break;
  }
  return prefix;
}

/**
 * Complete the token at the caret.
 *
 * Fills in as far as every candidate agrees. If that lands on exactly one
 * candidate the token is finished and a space follows, so typing carries on in
 * the sentence rather than inside the tag. Otherwise the shared prefix goes in
 * and the caller can call again with `rotate` to cycle the options.
 *
 * `rotate` steps through the options — pressing Tab again cycles them one at a
 * time, the way a shell does rather than printing a list. It comes with
 * `baseWord`: the partial the user actually typed. Without it the second press
 * would narrow against the word the first press just wrote in, find one match,
 * and stop cycling after a single step.
 */
export function completeOmniToken(
  text: string,
  caret: number,
  tagNames: string[],
  rotate?: number,
  baseWord?: string
): OmniCompletion | null {
  const token = tokenAtCaret(text, caret);
  if (!token || !token.word) return null;

  const pool = token.prefix === "#" ? tagNames : [...PRIORITY_WORDS];
  const typed = baseWord ?? token.word;
  const candidates = candidatesFor(typed, pool);
  if (!candidates.length) return null;

  const head = text.slice(0, token.start);
  const tail = text.slice(caret);

  const finish = (word: string, exact: boolean): OmniCompletion => {
    // A finished tag gets a trailing space so the next keystroke is prose.
    // Not when the tail already starts with one, or we'd double it.
    const space = exact && !tail.startsWith(" ") ? " " : "";
    const completed = `${token.prefix}${word}${space}`;
    return {
      text: `${head}${completed}${tail}`,
      caret: token.start + completed.length,
      completion: word,
      exact,
    };
  };

  if (candidates.length === 1) return finish(candidates[0], true);

  // Several options. Fill in what they agree on first; only once that's
  // already typed does Tab start cycling.
  const shared = commonPrefix(candidates);
  if (rotate === undefined && shared.length > typed.length) {
    return finish(shared, false);
  }

  const pick = candidates[(rotate ?? 0) % candidates.length];
  return finish(pick, false);
}
