import { tagCount } from "@/lib/metrics";
import type { Task, Note, Tag } from "@/lib/schemas";
import { TagRailClient } from "./TagRailClient";

type Props = {
  tags: Tag[];
  tasks: Task[];
  notes: Note[];
};

export function TagRail({ tags, tasks, notes }: Props) {
  const items = tags.map((tag) => ({
    ...tag,
    count: tagCount(tag.id, tasks, notes),
  }));

  return <TagRailClient tags={items} />;
}
