"use client";

import type { Tag } from "@/lib/schemas";
import { tagBg } from "@/lib/parse";
import { cn } from "@/lib/utils";

type Props = {
  tags: Tag[];
  selectedTagIds: string[];
  onToggle: (tagId: string) => void;
};

export function TagGridPicker({ tags, selectedTagIds, onToggle }: Props) {
  const selected = new Set(selectedTagIds);

  if (!tags.length) {
    return (
      <p className="m-0 text-[12px] text-faint">No tags yet — add some in Settings.</p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
      {tags.map((tag) => {
        const active = selected.has(tag.id);
        return (
          <button
            key={tag.id}
            type="button"
            onClick={() => onToggle(tag.id)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-left font-mono text-[11px] transition-all",
              active
                ? "border-2 font-bold shadow-[1px_1px_0_var(--shadow)]"
                : "border-border bg-surface2/60 font-medium text-muted hover:border-faint hover:bg-surface2"
            )}
            style={
              active
                ? {
                    color: tag.color,
                    background: tagBg(tag.color),
                    borderColor: tag.color,
                  }
                : undefined
            }
          >
            <span
              className="h-2 w-2 shrink-0 rounded-full ring-1 ring-black/5"
              style={{ background: tag.color }}
            />
            <span className="truncate">{tag.name}</span>
          </button>
        );
      })}
    </div>
  );
}
