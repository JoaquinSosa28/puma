import { describe, it, expect } from "vitest";
import { sortTasksByPriority } from "@/lib/task-order";
import type { Task } from "@/lib/schemas";

function task(over: Partial<Task> & { id: string }): Task {
  return {
    userId: "u",
    title: over.id,
    description: "",
    subtasks: [],
    tagIds: [],
    priority: "med",
    status: "todo",
    due: null,
    projectId: null,
    goalId: null,
    lifeArea: "personal",
    order: 0,
    createdAt: "",
    completedAt: null,
    timeSpentSec: 0,
    timerStartedAt: null,
    ...over,
  } as Task;
}

const ids = (ts: Task[]) => ts.map((t) => t.id);

describe("sortTasksByPriority", () => {
  it("puts the highest priority first", () => {
    const out = sortTasksByPriority([
      task({ id: "low", priority: "low" }),
      task({ id: "high", priority: "high" }),
      task({ id: "med", priority: "med" }),
    ]);
    expect(ids(out)).toEqual(["high", "med", "low"]);
  });

  it("sinks done tasks below open ones, whatever their priority", () => {
    const out = sortTasksByPriority([
      task({ id: "doneHigh", priority: "high", status: "done" }),
      task({ id: "openLow", priority: "low" }),
    ]);
    expect(ids(out)).toEqual(["openLow", "doneHigh"]);
  });

  it("still ranks done tasks among themselves", () => {
    const out = sortTasksByPriority([
      task({ id: "doneLow", priority: "low", status: "done" }),
      task({ id: "doneHigh", priority: "high", status: "done" }),
      task({ id: "open", priority: "med" }),
    ]);
    expect(ids(out)).toEqual(["open", "doneHigh", "doneLow"]);
  });

  it("keeps timed tasks chronological within a priority band", () => {
    const out = sortTasksByPriority([
      task({ id: "afternoon", priority: "high", due: "2026-08-01T14:00" }),
      task({ id: "morning", priority: "high", due: "2026-08-01T09:00" }),
    ]);
    expect(ids(out)).toEqual(["morning", "afternoon"]);
  });

  it("puts timed tasks before untimed ones in the same band", () => {
    const out = sortTasksByPriority([
      task({ id: "untimed", priority: "high", due: "2026-08-01" }),
      task({ id: "timed", priority: "high", due: "2026-08-01T09:00" }),
    ]);
    expect(ids(out)).toEqual(["timed", "untimed"]);
  });

  it("is stable — equal tasks keep their original order", () => {
    const out = sortTasksByPriority([
      task({ id: "a", priority: "med" }),
      task({ id: "b", priority: "med" }),
      task({ id: "c", priority: "med" }),
    ]);
    expect(ids(out)).toEqual(["a", "b", "c"]);
  });

  it("does not mutate the input", () => {
    const input = [
      task({ id: "low", priority: "low" }),
      task({ id: "high", priority: "high" }),
    ];
    sortTasksByPriority(input);
    expect(ids(input)).toEqual(["low", "high"]);
  });
});
