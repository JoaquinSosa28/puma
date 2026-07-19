// Pure, no server-only import — unit-testable. Shared by every place that
// mutates task/note tagIds so the "work"/"personal" special tags and
// lifeArea never drift apart.
import type { EntityLifeArea } from "@/lib/types";

export const SPECIAL_LIFE_TAGS = ["work", "personal"] as const;

/**
 * Derive a task/note's lifeArea from its tags. Only the special "work"/
 * "personal" tags (matched case-insensitively) drive this — both present
 * means "both", either alone means that area, and if NEITHER is present the
 * item's area is left as-is (tags are dynamic; their absence must never move
 * an item that was placed deliberately).
 */
export function deriveLifeAreaFromTags(
  tagIds: string[],
  tags: { id: string; name: string }[],
  current: EntityLifeArea
): EntityLifeArea {
  const nameById = new Map(tags.map((t) => [t.id, t.name.toLowerCase()]));
  const names = new Set(
    tagIds.map((id) => nameById.get(id)).filter((n): n is string => Boolean(n))
  );
  const hasWork = names.has("work");
  const hasPersonal = names.has("personal");
  if (hasWork && hasPersonal) return "both";
  if (hasWork) return "work";
  if (hasPersonal) return "personal";
  return current;
}
