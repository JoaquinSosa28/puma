"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition, useState, useCallback, useEffect } from "react";
import { useSyncedDraft } from "@/lib/use-synced-draft";
import { Star } from "lucide-react";
import type { Note, Tag } from "@/lib/schemas";
import { tagBg } from "@/lib/parse";
import {
  updateNoteAction,
  toggleNotePin,
  deleteNoteAction,
  convertNoteToTask,
} from "@/lib/actions/notes";
import { Topbar } from "@/components/shell/Topbar";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { hrefWithLife, type LifeView } from "@/lib/life-area";
import { Taggable } from "@/components/tags/TagMenuProvider";

type Props = {
  notes: Note[];
  tags: Tag[];
  selectedId: string | null;
  stats: { dayPct: number; habitsLabel: string; topStreak: number };
  lifeView?: LifeView;
  birthDate?: string | null;
  lifeSpanYears?: number;
};

function NotePinButton({
  pinned,
  onToggle,
  className,
}: {
  pinned: boolean;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
      className={cn(
        "shrink-0 rounded-md p-1 transition-colors hover:bg-hover",
        pinned ? "text-amber-500" : "text-faint2 hover:text-faint",
        className
      )}
      title={pinned ? "Remove from favorites" : "Add to favorites"}
      aria-label={pinned ? "Unfavorite note" : "Favorite note"}
    >
      <Star
        className="h-[18px] w-[18px]"
        strokeWidth={2}
        fill={pinned ? "currentColor" : "none"}
      />
    </button>
  );
}

export function NotesView({
  notes,
  tags,
  selectedId,
  stats,
  lifeView = "both",
  birthDate = null,
  lifeSpanYears,
}: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const sorted = [...notes].sort(
    (a, b) =>
      Number(b.pinned) - Number(a.pinned) ||
      (a.updatedAt < b.updatedAt ? 1 : -1)
  );
  const selected = sorted.find((n) => n.id === selectedId) ?? sorted[0] ?? null;
  const tagMap = new Map(tags.map((t) => [t.id, t]));

  const togglePin = (noteId: string) => {
    startTransition(async () => {
      const res = await toggleNotePin(noteId);
      if (!res.ok) {
        toast.error(res.error ?? "Could not update favorite");
        return;
      }
      router.refresh();
    });
  };

  return (
    <>
      <Topbar
        title="Notes"
        dayPct={stats.dayPct}
        habitsLabel={stats.habitsLabel}
        topStreak={stats.topStreak}
        birthDate={birthDate}
        lifeSpanYears={lifeSpanYears}
      />
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden pb-6 animate-puma-view lg:flex-row lg:gap-[18px]">
        <div className="flex min-h-0 shrink-0 flex-col max-lg:max-h-[34vh] lg:w-[300px]">
          <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
            {sorted.map((n) => (
              <Taggable
                key={n.id}
                entity="note"
                id={n.id}
                tagIds={n.tagIds}
                lifeArea={n.lifeArea}
                className={cn(
                  "flex items-start gap-1 rounded-[10px] border p-3 hover:bg-hover",
                  selected?.id === n.id
                    ? "border-faint2 bg-hover"
                    : "border-border"
                )}
              >
                <Link href={hrefWithLife(`/notes/${n.id}`, lifeView)} className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-1.5">
                    <span className="flex-1 truncate text-[13.5px] font-bold">
                      {n.title}
                    </span>
                  </div>
                  <div className="line-clamp-2 h-[34px] text-xs leading-snug text-muted">
                    {n.body || "No content yet."}
                  </div>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    {n.tagIds.map((id) => {
                      const tg = tagMap.get(id);
                      if (!tg) return null;
                      return (
                        <span
                          key={id}
                          className="rounded px-1.5 py-px font-mono text-[9px]"
                          style={{ color: tg.color, background: tagBg(tg.color) }}
                        >
                          {tg.name}
                        </span>
                      );
                    })}
                    <span className="ml-auto font-mono text-[9px] text-faint2">
                      {n.updatedAt.slice(5)}
                    </span>
                  </div>
                </Link>
                <NotePinButton
                  pinned={n.pinned}
                  onToggle={() => togglePin(n.id)}
                />
              </Taggable>
            ))}
          </div>
        </div>
        {selected && (
          <NoteEditor
            key={selected.id}
            note={selected}
            onRefresh={() => router.refresh()}
            onTogglePin={() => togglePin(selected.id)}
          />
        )}
      </div>
    </>
  );
}

function NoteEditor({
  note,
  onRefresh,
  onTogglePin,
}: {
  note: Note;
  onRefresh: () => void;
  onTogglePin: () => void;
}) {
  const [title, setTitle] = useSyncedDraft(note.title, note.id);
  const [body, setBody] = useSyncedDraft(note.body, note.id);
  const [pinned, setPinned] = useState(note.pinned);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setPinned(note.pinned);
  }, [note.id, note.pinned]);

  const save = useCallback(
    (field: "title" | "body", value: string) => {
      startTransition(async () => {
        await updateNoteAction(note.id, field, value);
        onRefresh();
      });
    },
    [note.id, onRefresh, startTransition]
  );

  const handleTogglePin = () => {
    setPinned((p) => !p);
    onTogglePin();
  };

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-[13px] border border-border bg-surface">
      <div className="flex items-center gap-2.5 border-b border-border2 px-5 py-4">
        <input
          className="flex-1 border-none bg-transparent text-xl font-bold tracking-tight text-ink outline-none"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => save("title", title)}
        />
        <NotePinButton pinned={pinned} onToggle={handleTogglePin} />
        <button
          type="button"
          className="rounded-md border border-tasks/40 bg-tasks/10 px-2.5 py-1 font-mono text-[11px] font-semibold text-tasks/80"
          onClick={() =>
            startTransition(async () => {
              await convertNoteToTask(note.id);
              toast.success("Converted to task");
              onRefresh();
            })
          }
        >
          → Task
        </button>
        <button
          type="button"
          className="text-[17px] leading-none text-faint2 hover:text-ink"
          onClick={() =>
            startTransition(async () => {
              await deleteNoteAction(note.id);
              toast.success("Note deleted");
              onRefresh();
            })
          }
        >
          ×
        </button>
      </div>
      <textarea
        className="flex-1 resize-none border-none bg-transparent px-5 py-4 text-[14.5px] leading-relaxed text-ink outline-none"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onBlur={() => save("body", body)}
        placeholder="Start writing… markdown supported (# heading, **bold**, - list)"
      />
      <div className="border-t border-border2 px-5 py-2 font-mono text-[10px] text-faint2">
        edited {note.updatedAt.slice(5)} · autosaves
      </div>
    </div>
  );
}
