// Pure rules for the tag <-> project link. No server-only import, so the
// invariants can be unit-tested without a database.

/** The shape both backends and the UI share for this. */
export type ProjectTagLike = {
  id: string;
  name: string;
  projectId?: string | null;
  isProjectPrimary?: boolean;
};

/** A tag that files whatever carries it under a project. */
export function isProjectTag(tag: ProjectTagLike): boolean {
  return Boolean(tag.projectId);
}

/**
 * The slug a new project's flagship tag gets: lowercase, no spaces, short
 * enough to be worth typing after a "#".
 *
 * "Side app MVP" -> "sideappmvp" is unhelpful, so words are joined by a dash
 * and the whole thing is capped. Empty input (a title of only punctuation)
 * falls back to "project" and the caller de-duplicates.
 */
export function projectTagSlug(title: string): string {
  const cleaned = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim();
  if (!cleaned) return "project";
  const words = cleaned.split(/[\s-]+/).filter(Boolean);
  // One word: take it whole. Several: initials read better than a long dash
  // chain and are quicker to type — "Side app MVP" -> "sam".
  const slug =
    words.length === 1 ? words[0] : words.map((w) => w[0]).join("");
  return slug.slice(0, 24) || "project";
}

/**
 * Pick a name not already taken, by appending a number. Compared
 * case-insensitively because tag names are matched that way everywhere.
 */
export function uniqueTagName(base: string, taken: string[]): string {
  const used = new Set(taken.map((n) => n.trim().toLowerCase()));
  if (!used.has(base.toLowerCase())) return base;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${base}${i}`;
    if (!used.has(candidate.toLowerCase())) return candidate;
  }
  return `${base}-${Date.now()}`;
}

/**
 * Which project a set of tags files something under.
 *
 * A task belongs to exactly one project, so carrying two project tags is not a
 * state worth representing — the newest one wins, which is what "I just typed
 * #ai" should mean. Returns null when no project tag is present, leaving the
 * caller to decide whether that clears the link.
 */
export function projectIdFromTags(
  tagIds: string[],
  tags: ProjectTagLike[]
): string | null {
  const byId = new Map(tags.map((t) => [t.id, t]));
  let found: string | null = null;
  for (const id of tagIds) {
    const projectId = byId.get(id)?.projectId;
    if (projectId) found = projectId;
  }
  return found;
}

/**
 * Drop every project tag except the one being kept, so a task never carries
 * two. Ordinary tags are untouched — those are shareable.
 */
export function withSingleProjectTag(
  tagIds: string[],
  keepProjectId: string | null,
  tags: ProjectTagLike[]
): string[] {
  const byId = new Map(tags.map((t) => [t.id, t]));
  return tagIds.filter((id) => {
    const tag = byId.get(id);
    if (!tag?.projectId) return true;
    return tag.projectId === keepProjectId;
  });
}

/** Every tag currently attached to a project, flagship first. */
export function tagsForProject<T extends ProjectTagLike>(
  tags: T[],
  projectId: string
): T[] {
  return tags
    .filter((t) => t.projectId === projectId)
    .sort((a, b) => Number(b.isProjectPrimary) - Number(a.isProjectPrimary));
}
