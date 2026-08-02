import { describe, it, expect } from "vitest";
import {
  EMPTY_SELECTION,
  intentFor,
  pruneSelection,
  reduceSelection,
  type SelectionState,
} from "@/lib/task-selection";

const ORDER = ["a", "b", "c", "d", "e"];

const state = (ids: string[], anchor: string | null = null): SelectionState => ({
  ids,
  anchor,
});

describe("intentFor", () => {
  it("reads a plain click as not-a-selection", () => {
    expect(intentFor({})).toBe("open");
  });

  it("treats cmd and ctrl the same", () => {
    expect(intentFor({ metaKey: true })).toBe("toggle");
    expect(intentFor({ ctrlKey: true })).toBe("toggle");
  });

  it("separates range from range-add", () => {
    expect(intentFor({ shiftKey: true })).toBe("range");
    expect(intentFor({ shiftKey: true, metaKey: true })).toBe("rangeAdd");
  });
});

describe("toggle", () => {
  it("adds, and keeps the list's own order", () => {
    const next = reduceSelection(state(["c"]), ORDER, "a", "toggle");
    expect(next.ids).toEqual(["a", "c"]);
    expect(next.anchor).toBe("a");
  });

  it("removes one that's already selected", () => {
    const next = reduceSelection(state(["a", "c"]), ORDER, "c", "toggle");
    expect(next.ids).toEqual(["a"]);
  });
});

describe("range", () => {
  it("covers everything between the anchor and the click, inclusive", () => {
    const next = reduceSelection(state(["b"], "b"), ORDER, "d", "range");
    expect(next.ids).toEqual(["b", "c", "d"]);
  });

  it("works upwards too", () => {
    const next = reduceSelection(state(["d"], "d"), ORDER, "b", "range");
    expect(next.ids).toEqual(["b", "c", "d"]);
  });

  it("keeps the anchor, so repeated shift-clicks resize one range", () => {
    const first = reduceSelection(state(["b"], "b"), ORDER, "e", "range");
    expect(first.ids).toEqual(["b", "c", "d", "e"]);
    const shrunk = reduceSelection(first, ORDER, "c", "range");
    expect(shrunk.ids).toEqual(["b", "c"]);
    expect(shrunk.anchor).toBe("b");
  });

  it("replaces the selection, while range-add keeps what was there", () => {
    const base = state(["a"], "c");
    expect(reduceSelection(base, ORDER, "d", "range").ids).toEqual(["c", "d"]);
    expect(reduceSelection(base, ORDER, "d", "rangeAdd").ids).toEqual([
      "a",
      "c",
      "d",
    ]);
  });

  it("with no anchor yet, selects just the click and becomes the anchor", () => {
    const next = reduceSelection(EMPTY_SELECTION, ORDER, "c", "range");
    expect(next).toEqual({ ids: ["c"], anchor: "c" });
  });

  it("re-anchors when the old anchor has been filtered out of the list", () => {
    // "z" was selected before the filter changed; it isn't on screen now.
    const next = reduceSelection(state(["z"], "z"), ORDER, "b", "range");
    expect(next).toEqual({ ids: ["b"], anchor: "b" });
  });
});

describe("a plain click", () => {
  it("clears the selection — the caller opens the task instead", () => {
    expect(reduceSelection(state(["a", "b"], "a"), ORDER, "c", "open")).toEqual(
      EMPTY_SELECTION
    );
  });
});

describe("pruneSelection", () => {
  it("returns the same object when nothing was lost", () => {
    const s = state(["a", "b"], "a");
    expect(pruneSelection(s, ORDER)).toBe(s);
  });

  it("drops ids and an anchor that left the list", () => {
    const next = pruneSelection(state(["a", "gone"], "gone"), ORDER);
    expect(next).toEqual({ ids: ["a"], anchor: null });
  });
});
