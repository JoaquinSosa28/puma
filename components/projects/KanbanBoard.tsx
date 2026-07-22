"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { Pencil } from "lucide-react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Task, Tag } from "@/lib/schemas";
import { tagBg } from "@/lib/parse";
import { moveTaskStatus } from "@/lib/actions/tasks";
import { TaskTimer } from "@/components/tasks/TaskTimer";
import { useTagMenu } from "@/components/tags/TagMenuProvider";
import { cn } from "@/lib/utils";

export type ColumnId = "todo" | "doing" | "done";

const COLS: { key: ColumnId; label: string; color: string }[] = [
  { key: "todo", label: "To do", color: "var(--faint2)" },
  { key: "doing", label: "Doing", color: "oklch(0.58 0.14 245)" },
  { key: "done", label: "Done", color: "oklch(0.6 0.13 155)" },
];

type ItemsByColumn = Record<ColumnId, Task[]>;

function groupByStatus(tasks: Task[]): ItemsByColumn {
  return {
    todo: tasks.filter((t) => t.status === "todo"),
    doing: tasks.filter((t) => t.status === "doing"),
    done: tasks.filter((t) => t.status === "done"),
  };
}

function findContainer(
  id: UniqueIdentifier,
  items: ItemsByColumn
): ColumnId | undefined {
  if (id === "todo" || id === "doing" || id === "done") return id;
  return COLS.find((col) => items[col.key].some((t) => t.id === id))?.key;
}

type Props = {
  tasks: Task[];
  tags: Tag[];
  /** Open the in-place task editor (right panel). Card click + pencil. */
  onEditTask: (taskId: string) => void;
};

export function KanbanBoard({ tasks, tags, onEditTask }: Props) {
  const [, startTransition] = useTransition();
  const [items, setItems] = useState<ItemsByColumn>(() => groupByStatus(tasks));
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [dragReady, setDragReady] = useState(false);
  // After a drag, the browser still fires a click on the dropped card — swallow
  // it so finishing a drag never pops the editor open.
  const suppressClickRef = useRef(false);
  const tagMap = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags]);

  const handleCardClick = (taskId: string) => {
    if (suppressClickRef.current) return;
    onEditTask(taskId);
  };

  useEffect(() => {
    setDragReady(true);
  }, []);

  useEffect(() => {
    setItems(groupByStatus(tasks));
  }, [tasks]);

  // Mouse drags start after a tiny move; touch needs a long-press first so
  // plain swipes keep scrolling the board instead of grabbing cards.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 280, tolerance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const activeTask = useMemo(() => {
    if (!activeId) return null;
    for (const col of COLS) {
      const hit = items[col.key].find((t) => t.id === activeId);
      if (hit) return hit;
    }
    return null;
  }, [activeId, items]);

  const handleDragStart = (event: DragStartEvent) => {
    suppressClickRef.current = true;
    setActiveId(event.active.id);
  };

  const releaseClickSuppression = () => {
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 150);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeContainer = findContainer(active.id, items);
    const overContainer = findContainer(over.id, items);
    if (!activeContainer || !overContainer || activeContainer === overContainer) {
      return;
    }

    setItems((prev) => {
      const activeItems = [...prev[activeContainer]];
      const overItems = [...prev[overContainer]];
      const activeIndex = activeItems.findIndex((t) => t.id === active.id);
      if (activeIndex < 0) return prev;

      const [moved] = activeItems.splice(activeIndex, 1);
      const updated = { ...moved, status: overContainer };

      const overIndex =
        over.id === overContainer
          ? overItems.length
          : overItems.findIndex((t) => t.id === over.id);

      overItems.splice(
        overIndex >= 0 ? overIndex : overItems.length,
        0,
        updated
      );

      return {
        ...prev,
        [activeContainer]: activeItems,
        [overContainer]: overItems,
      };
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    releaseClickSuppression();
    if (!over) return;

    const activeContainer = findContainer(active.id, items);
    const overContainer = findContainer(over.id, items);
    if (!activeContainer || !overContainer) return;

    const taskId = String(active.id);
    const original = tasks.find((t) => t.id === taskId);
    let nextStatus = overContainer;

    if (activeContainer === overContainer) {
      const columnItems = items[activeContainer];
      const oldIndex = columnItems.findIndex((t) => t.id === active.id);
      const newIndex = columnItems.findIndex((t) => t.id === over.id);
      if (oldIndex !== newIndex && newIndex >= 0) {
        setItems((prev) => ({
          ...prev,
          [activeContainer]: arrayMove(prev[activeContainer], oldIndex, newIndex),
        }));
      }
      nextStatus = activeContainer;
    }

    if (original && original.status !== nextStatus) {
      startTransition(async () => {
        // moveTaskStatus revalidates the route; the optimistic column state
        // above holds until it lands — no extra refresh round-trip.
        await moveTaskStatus(taskId, nextStatus);
      });
    }
  };

  const handleDragCancel = () => {
    setActiveId(null);
    releaseClickSuppression();
    setItems(groupByStatus(tasks));
  };

  const columnBody = (col: (typeof COLS)[number]) => (
    <>
      {items[col.key].map((task) => (
        <KanbanCardShell
          key={task.id}
          task={task}
          tagMap={tagMap}
          onEdit={handleCardClick}
        />
      ))}
      {items[col.key].length === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border2 px-4 py-8 text-center text-[11px] leading-relaxed text-faint">
          {col.key === "todo"
            ? "Nothing to do — capture a task with +"
            : col.key === "doing"
              ? "Long-press a card and drag it here"
              : "Finished tasks land here"}
        </div>
      ) : null}
    </>
  );

  if (!dragReady) {
    return (
      <div className="h-full min-h-0 flex-1 gap-3.5 max-lg:flex max-lg:snap-x max-lg:snap-mandatory max-lg:gap-3 max-lg:overflow-x-auto max-lg:overscroll-x-contain max-lg:scroll-px-3 lg:grid lg:grid-cols-3">
        {COLS.map((col) => (
          <KanbanColumnStatic
            key={col.key}
            label={col.label}
            color={col.color}
            count={items[col.key].length}
          >
            {columnBody(col)}
          </KanbanColumnStatic>
        ))}
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="h-full min-h-0 flex-1 gap-3.5 max-lg:flex max-lg:snap-x max-lg:snap-mandatory max-lg:gap-3 max-lg:overflow-x-auto max-lg:overscroll-x-contain max-lg:scroll-px-3 lg:grid lg:grid-cols-3">
        {COLS.map((col) => (
          <KanbanColumn
            key={col.key}
            id={col.key}
            label={col.label}
            color={col.color}
            count={items[col.key].length}
            isDragging={activeId !== null}
          >
            <SortableContext
              items={items[col.key].map((t) => t.id)}
              strategy={verticalListSortingStrategy}
            >
              {items[col.key].map((task) => (
                <KanbanCard
                  key={task.id}
                  task={task}
                  tagMap={tagMap}
                  onEdit={handleCardClick}
                />
              ))}
              {items[col.key].length === 0 ? (
                <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border2 px-4 py-8 text-center text-[11px] leading-relaxed text-faint">
                  {col.key === "todo"
                    ? "Nothing to do — capture a task with +"
                    : col.key === "doing"
                      ? "Long-press a card and drag it here"
                      : "Finished tasks land here"}
                </div>
              ) : null}
            </SortableContext>
          </KanbanColumn>
        ))}
      </div>

      <DragOverlay dropAnimation={dropAnimation}>
        {activeTask ? (
          <KanbanCardShell task={activeTask} tagMap={tagMap} overlay />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

const dropAnimation = {
  duration: 220,
  easing: "cubic-bezier(0.22, 1, 0.36, 1)",
};

function KanbanColumnStatic({
  label,
  color,
  count,
  children,
}: {
  label: string;
  color: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="kanban-column flex min-h-0 flex-col rounded-xl border border-border bg-surface2 p-3 max-lg:w-[76vw] md:max-lg:w-[44vw] max-lg:max-w-[360px] max-lg:shrink-0 max-lg:snap-center">
      <div className="mb-2.5 flex items-center gap-1.5 px-0.5">
        <span
          className="h-2 w-2 rounded-full"
          style={{ background: color }}
        />
        <span className="text-[12.5px] font-bold">{label}</span>
        <span className="font-mono text-[10px] text-faint">{count}</span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}

function KanbanColumn({
  id,
  label,
  color,
  count,
  isDragging,
  children,
}: {
  id: ColumnId;
  label: string;
  color: string;
  count: number;
  isDragging: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id, data: { type: "column" } });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "kanban-column flex min-h-0 flex-col rounded-xl border p-3 transition-all duration-200 ease-out max-lg:w-[76vw] md:max-lg:w-[44vw] max-lg:max-w-[360px] max-lg:shrink-0 max-lg:snap-center",
        isOver
          ? "kanban-column--over border-primary/40 bg-primary/[0.04] shadow-[inset_0_0_0_1px_oklch(0.55_0.16_274/0.15)]"
          : "border-border bg-surface2",
        isDragging && !isOver && "opacity-95"
      )}
    >
      <div className="mb-2.5 flex items-center gap-1.5 px-0.5">
        <span
          className="h-2 w-2 rounded-full transition-transform duration-200"
          style={{
            background: color,
            transform: isOver ? "scale(1.25)" : undefined,
          }}
        />
        <span className="text-[12.5px] font-bold">{label}</span>
        <span className="font-mono text-[10px] text-faint">{count}</span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}

function KanbanCard({
  task,
  tagMap,
  onEdit,
}: {
  task: Task;
  tagMap: Map<string, Tag>;
  onEdit: (taskId: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, data: { type: "task", status: task.status } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition ?? "transform 200ms cubic-bezier(0.22, 1, 0.36, 1)",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "kanban-card cursor-grab touch-manipulation active:cursor-grabbing",
        isDragging && "kanban-card--dragging opacity-35"
      )}
      {...attributes}
      {...listeners}
    >
      <KanbanCardShell task={task} tagMap={tagMap} onEdit={onEdit} />
    </div>
  );
}

function KanbanCardShell({
  task,
  tagMap,
  onEdit,
  overlay = false,
}: {
  task: Task;
  tagMap: Map<string, Tag>;
  onEdit?: (taskId: string) => void;
  overlay?: boolean;
}) {
  const { open } = useTagMenu();
  return (
    <div
      onClick={overlay ? undefined : () => onEdit?.(task.id)}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        open({
          entity: "task",
          id: task.id,
          tagIds: task.tagIds,
          lifeArea: task.lifeArea,
          x: e.clientX,
          y: e.clientY,
        });
      }}
      className={cn(
        "rounded-lg border border-border bg-surface p-[10px_11px]",
        overlay
          ? "kanban-card--overlay rotate-[1.5deg] cursor-grabbing"
          : "cursor-pointer hover:border-faint2 hover:shadow-sm"
      )}
    >
      <div className="mb-2 flex items-start gap-1.5">
        <div className="min-w-0 flex-1 text-[13px] font-medium leading-snug">
          {task.title}
        </div>
        {!overlay && (
          <button
            type="button"
            title="Edit task"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-faint transition-colors hover:bg-hover hover:text-ink"
            onClick={(e) => {
              e.stopPropagation();
              onEdit?.(task.id);
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <TaskTimer task={task} compact stopPropagation />
        {task.tagIds.map((id) => {
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
      </div>
    </div>
  );
}
