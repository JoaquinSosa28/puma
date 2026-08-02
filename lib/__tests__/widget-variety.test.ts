import { describe, it, expect } from "vitest";
import { diversifyWidgets } from "@/lib/ai/widget-variety";
import type { Widget } from "@/lib/ai/ask-schema";

const item = (label: string, value: number) => ({
  label,
  value,
  entityKind: "none" as const,
  entityId: "",
  href: "",
});

const bar = (title: string, altPie?: boolean): Widget => ({
  type: "bar",
  title,
  span: "2",
  unit: "",
  altPie,
  series: [item("a", 3), item("b", 1)],
});

const pie = (title: string, altBar?: boolean): Widget => ({
  type: "pie",
  title,
  span: "1",
  unit: "",
  centerLabel: "",
  altBar,
  slices: [item("a", 3), item("b", 1)],
});

describe("diversifyWidgets", () => {
  it("turns a repeated bar into a pie when the model marked it convertible", () => {
    const out = diversifyWidgets([bar("first"), bar("second", true)]);
    expect(out[0].type).toBe("bar");
    expect(out[1].type).toBe("pie");
    // The swap is lossless: same items, same span.
    expect((out[1] as Extract<Widget, { type: "pie" }>).slices).toHaveLength(2);
    expect(out[1].span).toBe("2");
  });

  it("leaves a repeat alone when the model did not mark it", () => {
    const out = diversifyWidgets([bar("first"), bar("second")]);
    expect(out.map((w) => w.type)).toEqual(["bar", "bar"]);
  });

  it("does not convert into a type the dashboard already has", () => {
    const out = diversifyWidgets([pie("p"), bar("b1"), bar("b2", true)]);
    // A pie exists — converting the second bar would just repeat pies.
    expect(out.map((w) => w.type)).toEqual(["pie", "bar", "bar"]);
  });

  it("converts the other way too", () => {
    const out = diversifyWidgets([pie("p1"), pie("p2", true)]);
    expect(out.map((w) => w.type)).toEqual(["pie", "bar"]);
  });

  it("the first of a type never converts", () => {
    const out = diversifyWidgets([bar("only", true)]);
    expect(out[0].type).toBe("bar");
  });
});
