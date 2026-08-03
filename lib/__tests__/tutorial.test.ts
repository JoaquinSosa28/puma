import { describe, it, expect } from "vitest";
import {
  BEATS,
  beatAt,
  beatStartMs,
  totalMs,
  typedChars,
  type Beat,
} from "@/lib/tutorial";

describe("the cut", () => {
  it("is about a minute — the promise made on the intro card", () => {
    const seconds = totalMs() / 1000;
    expect(seconds).toBeGreaterThanOrEqual(50);
    expect(seconds).toBeLessThanOrEqual(70);
  });

  it("gives every beat a caption short enough to read while it plays", () => {
    for (const beat of BEATS) {
      expect(beat.caption.length).toBeLessThanOrEqual(52);
      expect(beat.ms).toBeGreaterThanOrEqual(6_000);
    }
  });

  it("has no duplicate ids — they key the scenes", () => {
    expect(new Set(BEATS.map((b) => b.id)).size).toBe(BEATS.length);
  });
});

const FAKE: Beat[] = [
  { id: "type", caption: "a", ms: 1000 },
  { id: "tab", caption: "b", ms: 2000 },
  { id: "tag", caption: "c", ms: 1000 },
];

describe("beatAt", () => {
  it("finds the beat playing right now", () => {
    expect(beatAt(0, FAKE).index).toBe(0);
    expect(beatAt(1500, FAKE).index).toBe(1);
    expect(beatAt(3500, FAKE).index).toBe(2);
  });

  it("reports how far through that beat we are", () => {
    expect(beatAt(500, FAKE).progress).toBeCloseTo(0.5);
    expect(beatAt(2000, FAKE).progress).toBeCloseTo(0.5);
  });

  it("holds on the closing frame instead of running off the end", () => {
    const past = beatAt(99_000, FAKE);
    expect(past.index).toBe(2);
    expect(past.progress).toBe(1);
  });

  it("hands a boundary to the beat that is starting, not the one that ended", () => {
    expect(beatAt(1000, FAKE).index).toBe(1);
  });
});

describe("beatStartMs", () => {
  it("adds up everything before it", () => {
    expect(beatStartMs(0, FAKE)).toBe(0);
    expect(beatStartMs(2, FAKE)).toBe(3000);
  });
});

describe("typedChars", () => {
  it("reveals the line as the beat plays", () => {
    expect(typedChars("hello", 0)).toBe("");
    expect(typedChars("hello", 1)).toBe("hello");
    expect(typedChars("hello", 0.5).length).toBe(3);
  });

  it("can be held to a window inside the beat, so the line lands early", () => {
    // Nothing before the window, complete once it closes — the rest of the
    // beat holds on the finished line.
    expect(typedChars("hello", 0.1, 0.2, 0.6)).toBe("");
    expect(typedChars("hello", 0.4, 0.2, 0.6)).toBe("hel");
    expect(typedChars("hello", 0.8, 0.2, 0.6)).toBe("hello");
  });
});
