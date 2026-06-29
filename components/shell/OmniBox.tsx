"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import type { OmniType } from "@/lib/types";
import type { Project, Tag, Task, Note } from "@/lib/schemas";
import { iso } from "@/lib/date";
import { parseOmni } from "@/lib/parse";
import { getCaptureContext } from "@/lib/capture-context";
import { createFromOmni, undoCreate } from "@/lib/actions/tasks";
import { cn } from "@/lib/utils";
import { useLifeView } from "@/components/shell/LifeAreaToggle";
import { lifeAreaForCreate } from "@/lib/life-area";
import { TagQuickPick, SelectedTagsTray } from "@/components/shell/TagQuickPick";
import { DueQuickPick } from "@/components/shell/DueQuickPick";
import { isEditableTarget } from "@/lib/is-editable-target";

const TYPE_META: Record<
  OmniType,
  { label: string; color: string; text: string }
> = {
  task: { label: "#task", color: "oklch(0.64 0.18 25)", text: "oklch(0.5 0.18 25)" },
  habit: { label: "#habit", color: "oklch(0.6 0.13 155)", text: "oklch(0.44 0.13 155)" },
  goal: { label: "#goal", color: "oklch(0.58 0.17 300)", text: "oklch(0.46 0.17 300)" },
  note: { label: "#note", color: "var(--faint)", text: "var(--muted)" },
};

const OMNI_TYPES: OmniType[] = ["task", "habit", "goal", "note"];

function omniAccent(type: OmniType): string {
  return type === "note" ? "var(--ink)" : TYPE_META[type].color;
}

function cycleOmniType(current: OmniType, direction: 1 | -1): OmniType {
  const index = OMNI_TYPES.indexOf(current);
  const next =
    (index + direction + OMNI_TYPES.length) % OMNI_TYPES.length;
  return OMNI_TYPES[next];
}

type Props = {
  tags: Tag[];
  tasks: Task[];
  notes: Note[];
  projects: Project[];
  defaultType?: OmniType;
};

export function OmniBox({ tags, tasks, notes, projects, defaultType = "task" }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [life] = useLifeView();
  const [text, setText] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [pickedDue, setPickedDue] = useState<string | null>(null);
  const [type, setType] = useState<OmniType>(defaultType);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const omniRef = useRef<HTMLDivElement>(null);

  const taggable = type === "task" || type === "note";
  const isTask = type === "task";
  const agendaDay =
    pathname === "/" ? searchParams.get("day")?.slice(0, 10) ?? null : null;

  const toggleTag = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId]
    );
  };

  const removeTag = (tagId: string) => {
    setSelectedTagIds((prev) => prev.filter((id) => id !== tagId));
  };

  const capture = useMemo(
    () =>
      getCaptureContext(
        pathname,
        searchParams,
        defaultType,
        projects.map((p) => ({ id: p.id, title: p.title }))
      ),
    [pathname, searchParams, defaultType, projects]
  );

  useEffect(() => {
    setType(capture.type);
  }, [capture.type, pathname, searchParams]);

  useEffect(() => {
    if (!taggable) setSelectedTagIds([]);
  }, [taggable]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key.length !== 1) return;
      if (isEditableTarget(document.activeElement)) return;

      e.preventDefault();
      inputRef.current?.focus();
      setText((prev) => prev + e.key);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      const root = omniRef.current;
      if (!root?.contains(document.activeElement)) return;
      e.preventDefault();
      (document.activeElement as HTMLElement | null)?.blur();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const parsed = parseOmni(text, tags);

  const defaultTaskDue = capture.due?.slice(0, 10) ?? agendaDay ?? iso();

  useEffect(() => {
    if (!isTask) {
      setPickedDue(null);
      return;
    }
    if (parsed.due) {
      setPickedDue(null);
    }
  }, [isTask, parsed.due]);

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const taskDue = parsed.due ?? pickedDue ?? defaultTaskDue;
    startTransition(async () => {
      const res = await createFromOmni({
        text: trimmed,
        type,
        projectId: type === "task" ? capture.projectId : undefined,
        due: type === "task" ? taskDue : undefined,
        goalCategory: type === "goal" ? capture.goalCategory : undefined,
        lifeArea: lifeAreaForCreate(life),
        tagIds: taggable ? selectedTagIds : undefined,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(res.data?.label ?? "Added", {
        action: res.undo
          ? {
              label: "UNDO",
              onClick: async () => {
                await undoCreate(res.undo!.entity, res.undo!.snapshot as string);
                router.refresh();
              },
            }
          : undefined,
      });
      setText("");
      setSelectedTagIds([]);
      setPickedDue(defaultTaskDue);
      router.refresh();
    });
  };

  return (
    <div
      ref={omniRef}
      className="omni-box group mb-[18px] shrink-0 rounded-[14px] border-2 border-ink bg-surface p-[13px_16px]"
      style={{ "--omni-accent": omniAccent(type) } as React.CSSProperties}
    >
      <div className="omni-box-motion" aria-hidden>
        <div className="omni-box-trace" />
        <div className="omni-box-shimmer" />
      </div>

      <div className="relative z-[1]">
      <div className="flex items-center gap-[11px]">
        <span
          className="shrink-0 rounded-[7px] px-[9px] py-1 font-mono text-xs font-semibold lowercase text-background transition-transform duration-200 group-focus-within:scale-[1.04]"
          style={{ background: TYPE_META[type].color }}
        >
          {TYPE_META[type].label}
        </span>
        {capture.hint && (
          <span className="shrink-0 font-mono text-[10px] text-faint transition-colors duration-200 group-focus-within:text-muted">
            → {capture.hint}
          </span>
        )}
        <input
          ref={inputRef}
          className="w-full border-none bg-transparent text-base font-medium text-ink outline-none transition-colors duration-200 placeholder:text-faint placeholder:transition-colors group-focus-within:placeholder:text-faint2"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Tab") {
              e.preventDefault();
              setType((current) => cycleOmniType(current, e.shiftKey ? -1 : 1));
              return;
            }
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={capture.placeholder}
          disabled={pending}
        />
        {parsed.dateLabel && (
          <span className="shrink-0 whitespace-nowrap rounded-md bg-primary/10 px-2 py-0.5 font-mono text-[11px] text-primary">
            📅 {parsed.dateLabel}
          </span>
        )}
        <span className="shrink-0 font-mono text-[10px] text-faint2 transition-all duration-200 group-focus-within:font-semibold group-focus-within:text-ink">
          ↵ add
        </span>
      </div>
      <div className="omni-box-scanline" aria-hidden />
      <div className="mt-2.5 flex min-w-0 items-center gap-2 border-t border-border2 py-2.5 pb-3">
        <span className="shrink-0 font-mono text-[10px] text-faint2">SAVE AS →</span>
        <div className="flex shrink-0 items-center gap-1">
          <TypeChip
            label="Task"
            dot="oklch(0.64 0.18 25)"
            accent="oklch(0.64 0.18 25)"
            textColor={TYPE_META.task.text}
            square
            active={type === "task"}
            onClick={() => setType("task")}
          />
          <TypeChip
            label="Habit"
            dot="oklch(0.6 0.13 155)"
            accent="oklch(0.6 0.13 155)"
            textColor={TYPE_META.habit.text}
            active={type === "habit"}
            onClick={() => setType("habit")}
          />
          <TypeChip
            label="Goal"
            dot="oklch(0.58 0.17 300)"
            accent="oklch(0.58 0.17 300)"
            textColor={TYPE_META.goal.text}
            diamond
            active={type === "goal"}
            onClick={() => setType("goal")}
          />
          <TypeChip
            label="Note"
            dot="var(--faint)"
            accent="var(--ink)"
            textColor="var(--ink)"
            square
            active={type === "note"}
            onClick={() => setType("note")}
          />
        </div>
        {isTask && !parsed.dateLabel && (
          <>
            <span className="h-3.5 w-px shrink-0 bg-border" aria-hidden />
            <DueQuickPick
              mode="capture"
              value={pickedDue}
              onChange={setPickedDue}
              disabled={pending}
            />
          </>
        )}
        {taggable && (
          <>
            <span className="h-3.5 w-px shrink-0 bg-border" aria-hidden />
            <TagQuickPick
              tags={tags}
              tasks={tasks}
              notes={notes}
              selectedTagIds={selectedTagIds}
              onToggle={toggleTag}
              showLabel={false}
            />
          </>
        )}
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {taggable && (
            <SelectedTagsTray
              selectedTagIds={selectedTagIds}
              allTags={tags}
              onRemove={removeTag}
            />
          )}
          <button
            type="button"
            onClick={submit}
            disabled={pending}
            className="cursor-pointer rounded-lg border-none bg-ink px-4 py-1 text-[12px] font-bold text-background"
          >
            Add
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}

function TypeChip({
  label,
  dot,
  accent,
  textColor,
  square,
  diamond,
  active,
  onClick,
}: {
  label: string;
  dot: string;
  accent: string;
  textColor: string;
  square?: boolean;
  diamond?: boolean;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-[11px] transition-all",
        active
          ? "border-2 font-bold shadow-[2px_2px_0_var(--shadow)]"
          : "border border-border bg-surface font-medium text-muted opacity-75 hover:border-faint hover:opacity-100"
      )}
      style={
        active
          ? {
              borderColor: accent,
              background: accent.includes("oklch")
                ? accent.replace(")", " / 0.28)")
                : "var(--hover)",
              color: textColor,
            }
          : undefined
      }
    >
      <span
        className={cn(
          "h-[6px] w-[6px]",
          square && "rounded-[2px]",
          !square && !diamond && "rounded-full",
          diamond && "rotate-45"
        )}
        style={{ background: dot }}
      />
      {label}
    </button>
  );
}
