import { describe, it, expect } from "vitest";
import {
  BEATS,
  checkCapture,
  progressAt,
  typedChars,
  watchMs,
} from "@/lib/tutorial";

describe("the cut", () => {
  it("gives every beat a caption short enough to read while it plays", () => {
    for (const beat of BEATS) {
      expect(beat.caption.length).toBeLessThanOrEqual(52);
      expect(beat.step.length).toBeLessThanOrEqual(12);
    }
  });

  it("has no duplicate ids — they key the scenes", () => {
    expect(new Set(BEATS.map((b) => b.id)).size).toBe(BEATS.length);
  });

  it("times every watch beat and no mission", () => {
    for (const beat of BEATS) {
      if (beat.kind === "watch") expect(beat.ms).toBeGreaterThan(0);
      else expect(beat.ms).toBeUndefined();
    }
  });

  it("gives every mission a line to show once it's cleared", () => {
    for (const beat of BEATS.filter((b) => b.kind === "do")) {
      expect(beat.done).toBeTruthy();
    }
  });

  it("is mostly doing rather than watching", () => {
    const missions = BEATS.filter((b) => b.kind === "do").length;
    expect(missions).toBeGreaterThan(BEATS.length / 2);
  });

  it("keeps the self-playing part short — the rest is up to the user", () => {
    expect(watchMs() / 1000).toBeLessThanOrEqual(30);
  });
});

describe("progressAt", () => {
  it("runs from nothing to everything across the beats", () => {
    expect(progressAt(0)).toBe(0);
    expect(progressAt(BEATS.length)).toBe(1);
    expect(progressAt(3)).toBeCloseTo(3 / BEATS.length);
  });

  it("never reports more than done, however far it's pushed", () => {
    expect(progressAt(99)).toBe(1);
    expect(progressAt(-1)).toBe(0);
  });
});

describe("typedChars", () => {
  it("reveals the line as the beat plays", () => {
    expect(typedChars("hello", 0)).toBe("");
    expect(typedChars("hello", 1)).toBe("hello");
    expect(typedChars("hello", 0.5).length).toBe(3);
  });

  it("can be held to a window inside the beat, so the line lands early", () => {
    expect(typedChars("hello", 0.1, 0.2, 0.6)).toBe("");
    expect(typedChars("hello", 0.4, 0.2, 0.6)).toBe("hel");
    expect(typedChars("hello", 0.8, 0.2, 0.6)).toBe("hello");
  });
});

describe("the capture mission", () => {
  it("accepts the example it puts on screen", () => {
    expect(checkCapture("pay rent friday #finance").ok).toBe(true);
  });

  it("wants all three parts, not two of them", () => {
    expect(checkCapture("pay rent friday").ok).toBe(false);
    expect(checkCapture("pay rent #finance").ok).toBe(false);
    expect(checkCapture("friday #finance").ok).toBe(false);
  });

  it("says which part is missing, so the chips can show it", () => {
    const c = checkCapture("pay rent #finance");
    expect(c.hasTitle).toBe(true);
    expect(c.hasTag).toBe(true);
    expect(c.hasDay).toBe(false);
  });

  it("doesn't count the tokens themselves as the title", () => {
    // Tokens only: nothing is actually being captured.
    expect(checkCapture("friday #finance").hasTitle).toBe(false);
    expect(checkCapture("tomorrow #work !high").hasTitle).toBe(false);
  });

  it("takes any day word and any tag, not just the example's", () => {
    expect(checkCapture("call the bank tomorrow #admin").ok).toBe(true);
    expect(checkCapture("gym session mon #health").ok).toBe(true);
  });

  it("ignores case, the way the parser does", () => {
    expect(checkCapture("Pay Rent FRIDAY #Finance").ok).toBe(true);
  });

  it("wants a real tag, not a lone hash", () => {
    expect(checkCapture("pay rent friday #").hasTag).toBe(false);
    expect(checkCapture("pay rent friday #a").hasTag).toBe(false);
  });
});
