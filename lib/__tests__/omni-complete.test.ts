import { describe, it, expect } from "vitest";
import {
  tokenAtCaret,
  bestCompletion,
  completeOmniToken,
} from "@/lib/omni-complete";

const tags = [
  "game-dev-ops",
  "game-design",
  "art",
  "work",
  "personal",
  "ai-tools",
  "open-ai",
];

describe("tokenAtCaret", () => {
  it("finds the partial tag being typed", () => {
    const t = tokenAtCaret("review #game", 12);
    expect(t).toEqual({ prefix: "#", word: "game", start: 7 });
  });

  it("finds a partial priority", () => {
    expect(tokenAtCaret("pay rent !hi", 12)?.word).toBe("hi");
  });

  it("ignores tokens the caret has moved past", () => {
    // Caret is after "and", not inside the tag.
    expect(tokenAtCaret("#art and", 8)).toBeNull();
  });

  it("returns null with no token", () => {
    expect(tokenAtCaret("buy milk", 8)).toBeNull();
  });
});

describe("bestCompletion", () => {
  it("prefers the longest prefix match", () => {
    // Both start with "game"; the longer one wins.
    expect(bestCompletion("game", tags)).toBe("game-dev-ops");
  });

  it("narrows as you type more", () => {
    expect(bestCompletion("game-dev", tags)).toBe("game-dev-ops");
    expect(bestCompletion("game-des", tags)).toBe("game-design");
  });

  it("prefers a prefix match over a mere substring", () => {
    // "ai-tools" starts with it; "open-ai" only contains it.
    expect(bestCompletion("ai", tags)).toBe("ai-tools");
  });

  it("falls back to a substring when nothing starts with it", () => {
    expect(bestCompletion("pen", tags)).toBe("open-ai");
  });

  it("returns null when already complete or unmatched", () => {
    expect(bestCompletion("art", ["art"])).toBeNull();
    expect(bestCompletion("zzz", tags)).toBeNull();
    expect(bestCompletion("", tags)).toBeNull();
  });
});

describe("completeOmniToken", () => {
  it("completes a tag in place", () => {
    const out = completeOmniToken("review #game", 12, tags);
    expect(out?.text).toBe("review #game-dev-ops");
    expect(out?.caret).toBe(20);
  });

  it("completes priorities from the ! prefix", () => {
    expect(completeOmniToken("pay rent !hi", 12, tags)?.text).toBe(
      "pay rent !high"
    );
    expect(completeOmniToken("pay rent !m", 11, tags)?.text).toBe(
      "pay rent !mid"
    );
  });

  it("keeps text after the caret", () => {
    const out = completeOmniToken("review #game later", 12, tags);
    expect(out?.text).toBe("review #game-dev-ops later");
    expect(out?.caret).toBe(20);
  });

  it("does nothing when there's nothing to complete", () => {
    expect(completeOmniToken("buy milk", 8, tags)).toBeNull();
    expect(completeOmniToken("review #", 8, tags)).toBeNull();
    expect(completeOmniToken("review #zzz", 11, tags)).toBeNull();
  });

  it("never completes a priority to a tag name", () => {
    // "!game" has no priority match, so it stays put.
    expect(completeOmniToken("x !game", 7, tags)).toBeNull();
  });
});
