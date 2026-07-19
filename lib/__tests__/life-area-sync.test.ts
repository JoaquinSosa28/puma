import { describe, it, expect } from "vitest";
import { deriveLifeAreaFromTags } from "@/lib/life-area-sync";
import { filterByLifeView } from "@/lib/life-area";

const tags = [
  { id: "t-work", name: "work" },
  { id: "t-personal", name: "personal" },
  { id: "t-other", name: "idea" },
];

describe("deriveLifeAreaFromTags", () => {
  it("both special tags -> both", () => {
    expect(
      deriveLifeAreaFromTags(["t-work", "t-personal"], tags, "personal")
    ).toBe("both");
  });

  it("work tag only -> work", () => {
    expect(deriveLifeAreaFromTags(["t-work"], tags, "personal")).toBe("work");
  });

  it("personal tag only -> personal", () => {
    expect(deriveLifeAreaFromTags(["t-personal"], tags, "work")).toBe(
      "personal"
    );
  });

  it("neither special tag present -> returns current unchanged", () => {
    expect(deriveLifeAreaFromTags(["t-other"], tags, "both")).toBe("both");
    expect(deriveLifeAreaFromTags([], tags, "work")).toBe("work");
  });

  it("matches tag names case-insensitively", () => {
    const upperTags = [
      { id: "t-work", name: "Work" },
      { id: "t-personal", name: "PERSONAL" },
    ];
    expect(deriveLifeAreaFromTags(["t-work"], upperTags, "personal")).toBe(
      "work"
    );
    expect(
      deriveLifeAreaFromTags(["t-work", "t-personal"], upperTags, "personal")
    ).toBe("both");
  });
});

describe("filterByLifeView", () => {
  const items = [
    { id: "1", lifeArea: "personal" as const },
    { id: "2", lifeArea: "work" as const },
    { id: "3", lifeArea: "both" as const },
  ];

  it("both view returns everything", () => {
    expect(filterByLifeView(items, "both").map((i) => i.id)).toEqual([
      "1",
      "2",
      "3",
    ]);
  });

  it("personal view includes personal + both items", () => {
    expect(filterByLifeView(items, "personal").map((i) => i.id)).toEqual([
      "1",
      "3",
    ]);
  });

  it("work view includes work + both items", () => {
    expect(filterByLifeView(items, "work").map((i) => i.id)).toEqual([
      "2",
      "3",
    ]);
  });
});
