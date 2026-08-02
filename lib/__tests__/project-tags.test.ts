import { describe, it, expect } from "vitest";
import {
  projectTagSlug,
  uniqueTagName,
  projectIdFromTags,
  withSingleProjectTag,
  tagsForProject,
  isProjectTag,
} from "@/lib/project-tags";

const tags = [
  { id: "t-work", name: "work" },
  { id: "t-idea", name: "idea" },
  { id: "t-ai", name: "ai", projectId: "p-ai", isProjectPrimary: true },
  { id: "t-ml", name: "ml", projectId: "p-ai" },
  { id: "t-web", name: "web", projectId: "p-web", isProjectPrimary: true },
];

describe("projectTagSlug", () => {
  it("uses a single word whole", () => {
    expect(projectTagSlug("Marketing")).toBe("marketing");
  });

  it("uses initials for multi-word titles", () => {
    expect(projectTagSlug("Side app MVP")).toBe("sam");
    expect(projectTagSlug("Website redesign")).toBe("wr");
  });

  it("strips punctuation and accents", () => {
    expect(projectTagSlug("Café — rebuild!")).toBe("cr");
    expect(projectTagSlug("Q3/Q4 push")).toBe("qp");
  });

  it("falls back rather than returning nothing", () => {
    expect(projectTagSlug("!!!")).toBe("project");
    expect(projectTagSlug("")).toBe("project");
  });
});

describe("uniqueTagName", () => {
  it("returns the base when it's free", () => {
    expect(uniqueTagName("ai", ["work", "idea"])).toBe("ai");
  });

  it("numbers off a collision, ignoring case", () => {
    expect(uniqueTagName("ai", ["AI"])).toBe("ai2");
    expect(uniqueTagName("ai", ["ai", "ai2"])).toBe("ai3");
  });
});

describe("projectIdFromTags", () => {
  it("finds the project a tag files under", () => {
    expect(projectIdFromTags(["t-work", "t-ai"], tags)).toBe("p-ai");
  });

  it("returns null with no project tag", () => {
    expect(projectIdFromTags(["t-work", "t-idea"], tags)).toBeNull();
  });

  it("lets the last project tag win", () => {
    // Two shouldn't coexist, but if they do, the most recently added is the
    // one the user just asked for.
    expect(projectIdFromTags(["t-ai", "t-web"], tags)).toBe("p-web");
  });

  it("treats two tags of the SAME project as that project", () => {
    expect(projectIdFromTags(["t-ai", "t-ml"], tags)).toBe("p-ai");
  });
});

describe("withSingleProjectTag", () => {
  it("drops project tags belonging to other projects", () => {
    expect(withSingleProjectTag(["t-ai", "t-web"], "p-web", tags)).toEqual([
      "t-web",
    ]);
  });

  it("keeps every ordinary tag — those are shareable", () => {
    expect(
      withSingleProjectTag(["t-work", "t-idea", "t-ai"], "p-ai", tags)
    ).toEqual(["t-work", "t-idea", "t-ai"]);
  });

  it("keeps several tags of the same project", () => {
    expect(withSingleProjectTag(["t-ai", "t-ml"], "p-ai", tags)).toEqual([
      "t-ai",
      "t-ml",
    ]);
  });

  it("strips all project tags when nothing is kept", () => {
    expect(withSingleProjectTag(["t-work", "t-ai"], null, tags)).toEqual([
      "t-work",
    ]);
  });
});

describe("tagsForProject", () => {
  it("returns the project's tags with the flagship first", () => {
    const out = tagsForProject(tags, "p-ai");
    expect(out.map((t) => t.name)).toEqual(["ai", "ml"]);
    expect(out[0].isProjectPrimary).toBe(true);
  });

  it("never returns another project's tags", () => {
    expect(tagsForProject(tags, "p-web").map((t) => t.name)).toEqual(["web"]);
  });
});

describe("isProjectTag", () => {
  it("is true only when a project owns it", () => {
    expect(isProjectTag(tags[0])).toBe(false);
    expect(isProjectTag(tags[2])).toBe(true);
  });
});
