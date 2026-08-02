"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  useMemo,
} from "react";
import { useRouter } from "next/navigation";
import { Check, Plus } from "lucide-react";
import type { Tag, Task, Note } from "@/lib/schemas";
import type { EntityLifeArea } from "@/lib/types";
import { toggleEntityTag, type TaggableEntity } from "@/lib/actions/tags";
import { addTagAction } from "@/lib/actions/settings";
import { tagsByUsage } from "@/lib/metrics";
import { isLifeTag, SPECIAL_LIFE_TAGS } from "@/lib/life-area-sync";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  withSingleProjectTag,
  projectIdFromTags,
} from "@/lib/project-tags";

type TagTarget = {
  entity: TaggableEntity;
  id: string;
  tagIds: string[];
  lifeArea: EntityLifeArea;
  x: number;
  y: number;
};


type TagMenuContextValue = {
  open: (target: Omit<TagTarget, "x" | "y"> & { x: number; y: number }) => void;
  /** Dismiss it — used when the thing it points at is about to move away. */
  close: () => void;
  /**
   * Tell the menu a drag is in flight. On a phone a long press both opens this
   * menu and arms a drag, so without this the menu ends up hovering over the
   * board pointing at a card that has since moved somewhere else.
   */
  setDragActive: (active: boolean) => void;
};

const TagMenuContext = createContext<TagMenuContextValue | null>(null);

export function useTagMenu() {
  const ctx = useContext(TagMenuContext);
  if (!ctx) {
    throw new Error("useTagMenu must be used within TagMenuProvider");
  }
  return ctx;
}

export function TagMenuProvider({
  tags,
  tasks,
  notes,
  children,
}: {
  tags: Tag[];
  tasks: Task[];
  notes: Note[];
  children: ReactNode;
}) {
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);
  const dirtyRef = useRef(false);
  const [menu, setMenu] = useState<TagTarget | null>(null);
  const [menuTags, setMenuTags] = useState<Tag[]>([]);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [newTag, setNewTag] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (menu) {
      setTagIds(menu.tagIds);
    }
  }, [menu]);

  const dragActiveRef = useRef(false);

  const close = useCallback(() => {
    setMenu(null);
    setMenuTags([]);
    setAdding(false);
    setNewTag("");
    if (dirtyRef.current) {
      dirtyRef.current = false;
      router.refresh();
    }
  }, [router]);

  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menu, close]);

  const setDragActive = useCallback(
    (active: boolean) => {
      dragActiveRef.current = active;
      // The press that armed the drag may already have opened the menu.
      if (active) close();
    },
    [close]
  );

  const open = useCallback(
    (target: TagTarget) => {
      // A long press that turned into a drag isn't a request for the menu.
      if (dragActiveRef.current) return;
      dirtyRef.current = false;
      setMenu(target);
      setTagIds(target.tagIds);
      setMenuTags(tagsByUsage(tags, tasks, notes));
      setAdding(false);
      setNewTag("");
    },
    [tags, tasks, notes]
  );

  const toggle = async (tagId: string) => {
    if (!menu || pending) return;
    setPending(true);
    const applied = !tagIds.includes(tagId);
    let nextTagIds = applied
      ? [...tagIds, tagId]
      : tagIds.filter((id) => id !== tagId);
    // The server files the task under the project this tag belongs to and
    // drops any other project's tags. Mirror it, or the ticks would show a
    // state that lasts only until the next render.
    nextTagIds = withSingleProjectTag(
      nextTagIds,
      projectIdFromTags(nextTagIds, tags),
      tags
    );
    setTagIds(nextTagIds);
    const res = await toggleEntityTag(menu.entity, menu.id, tagId);
    setPending(false);
    if (!res.ok) {
      setTagIds(menu.tagIds);
      toast.error(res.error);
      return;
    }
    dirtyRef.current = true;
  };

  const handleAddTag = async () => {
    const name = newTag.trim().toLowerCase();
    if (!name || !menu || pending) return;
    setPending(true);
    const existing = tags.find((t) => t.name === name);
    if (existing) {
      if (!tagIds.includes(existing.id)) {
        await toggleEntityTag(menu.entity, menu.id, existing.id);
        const nextTagIds = [...tagIds, existing.id];
        setTagIds(nextTagIds);
      }
      setPending(false);
      setAdding(false);
      setNewTag("");
      dirtyRef.current = true;
      return;
    }
    const res = await addTagAction(name);
    if (!res.ok) {
      toast.error(res.error);
      setPending(false);
      return;
    }
    await toggleEntityTag(menu.entity, menu.id, res.data!.id);
    const nextTagIds = [...tagIds, res.data!.id];
    setTagIds(nextTagIds);
    setMenuTags((prev) => [...prev, res.data!]);
    setPending(false);
    setAdding(false);
    setNewTag("");
    toast.success(`Tagged with ${name}`);
    dirtyRef.current = true;
  };

  // Life tags are the personal/work split, not labels — they get their own
  // outlined box so they read as a different kind of thing, while still being
  // tags you toggle rather than a separate control.
  const lifeTags = menu
    ? SPECIAL_LIFE_TAGS.map((name) =>
        menuTags.find((t) => t.name.toLowerCase() === name)
      ).filter((t): t is NonNullable<typeof t> => Boolean(t))
    : [];
  const ranked = menu ? menuTags.filter((t) => !isLifeTag(t.name)) : [];

  const pos = menu
    ? (() => {
        const w = 200;
        const h = Math.min(
          400,
          56 + ranked.length * 32 + lifeTags.length * 30 + (adding ? 44 : 28) + 72
        );
        const x = Math.min(menu.x, window.innerWidth - w - 8);
        const y = Math.min(menu.y, window.innerHeight - h - 8);
        return { left: Math.max(8, x), top: Math.max(8, y) };
      })()
    : null;

  const tagMenuValue = useMemo(
    () => ({ open, close, setDragActive }),
    [open, close, setDragActive]
  );

  return (
    <TagMenuContext.Provider value={tagMenuValue}>
      {children}
      {menu && pos && (
        <>
          <div
            className="fixed inset-0 z-[100]"
            onClick={close}
            onContextMenu={(e) => {
              e.preventDefault();
              close();
            }}
          />
          <div
            ref={menuRef}
            className="fixed z-[101] w-[200px] overflow-hidden rounded-lg border border-border bg-surface p-1 shadow-lg"
            style={{ left: pos.left, top: pos.top }}
            onContextMenu={(e) => e.preventDefault()}
          >
            {lifeTags.length > 0 && (
              <div className="mb-1 rounded-md border border-dashed border-border2 bg-surface2/50 p-1">
                <div className="px-1 pb-0.5 pt-0.5 font-mono text-[9px] font-medium tracking-widest text-faint2">
                  LIFE AREA
                </div>
                {lifeTags.map((tag) => {
                  const active = tagIds.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      disabled={pending}
                      onClick={() => toggle(tag.id)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-[12px] transition-colors hover:bg-hover disabled:opacity-50",
                        active ? "font-semibold text-ink" : "text-muted"
                      )}
                    >
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: tag.color }}
                      />
                      <span className="min-w-0 flex-1 truncate">{tag.name}</span>
                      {active && (
                        <Check
                          className="h-3.5 w-3.5 shrink-0 text-habits"
                          strokeWidth={2.5}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
            <div className="px-2 py-1.5 font-mono text-[9px] font-medium tracking-widest text-faint2">
              TAG
            </div>
            <div className="max-h-[220px] overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none]">
              {ranked.length === 0 && !adding && (
                <p className="px-2 py-1.5 text-[11px] text-faint">No tags yet</p>
              )}
              {ranked.map((tag) => {
                const active = tagIds.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    disabled={pending}
                    onClick={() => toggle(tag.id)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] text-ink hover:bg-hover disabled:opacity-50"
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: tag.color }}
                    />
                    <span className="min-w-0 flex-1 truncate">{tag.name}</span>
                    {active && (
                      <Check className="h-3.5 w-3.5 shrink-0 text-habits" strokeWidth={2.5} />
                    )}
                  </button>
                );
              })}
            </div>
            <div className="mt-1 border-t border-border2 pt-1">
              {adding ? (
                <div className="flex gap-1 px-1">
                  <input
                    autoFocus
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void handleAddTag();
                      if (e.key === "Escape") {
                        setAdding(false);
                        setNewTag("");
                      }
                    }}
                    placeholder="new tag"
                    className="min-w-0 flex-1 rounded-md border border-border bg-surface2 px-2 py-1 font-mono text-[11px] outline-none focus:border-faint"
                  />
                  <button
                    type="button"
                    onClick={() => void handleAddTag()}
                    disabled={pending || !newTag.trim()}
                    className="rounded-md bg-ink px-2 py-1 text-[10px] font-semibold text-background disabled:opacity-40"
                  >
                    Add
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAdding(true)}
                  className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] text-muted hover:bg-hover"
                >
                  <Plus className="h-3.5 w-3.5" />
                  New tag
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </TagMenuContext.Provider>
  );
}

export function Taggable({
  entity,
  id,
  tagIds,
  lifeArea,
  className,
  children,
  onClick,
}: {
  entity: TaggableEntity;
  id: string;
  tagIds: string[];
  lifeArea: EntityLifeArea;
  className?: string;
  children: ReactNode;
  onClick?: () => void;
}) {
  const { open } = useTagMenu();
  return (
    <div
      className={cn(className)}
      data-task-id={entity === "task" ? id : undefined}
      onClick={onClick}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        open({ entity, id, tagIds, lifeArea, x: e.clientX, y: e.clientY });
      }}
    >
      {children}
    </div>
  );
}
