import { describe, it, expect } from "vitest";
import { iso, addDays, streakOf, bestStreak, weekDates, currentAgendaIndex } from "@/lib/date";
import { parseOmni, parseNoteCapture, toggleTagInText } from "@/lib/parse";
import { defaultNoteTitle } from "@/lib/date";
import {
  buildAgendaBlocks,
  findNowPlacement,
  formatDeadTimeLabel,
  parseAgendaDurationMins,
} from "@/lib/agenda-timeline";
import { dayDonePercent, tagsByUsage } from "@/lib/metrics";
import {
  DEFAULT_HABIT_VISIBILITY,
  habitHeatCells,
} from "@/lib/habit-visibility";
import type { Tag } from "@/lib/schemas";

const tags: Tag[] = [
  {
    id: "1",
    name: "work",
    color: "oklch(0.58 0.14 245)",
    isDefault: false,
    order: 0,
    createdAt: "2025-01-01",
  },
];

const TZ = "UTC";

describe("date", () => {
  it("iso formats YYYY-MM-DD", () => {
    expect(iso(new Date("2025-06-15T12:00:00Z"), TZ)).toBe("2025-06-15");
  });

  it("streakOf counts consecutive days", () => {
    const td = "2026-06-21";
    const set = new Set([
      iso(addDays(-2, new Date(`${td}T12:00:00Z`), TZ), TZ),
      iso(addDays(-1, new Date(`${td}T12:00:00Z`), TZ), TZ),
      td,
    ]);
    expect(streakOf(set, td, TZ)).toBe(3);
  });

  it("bestStreak finds longest run", () => {
    const set = new Set(["2025-01-01", "2025-01-02", "2025-01-05", "2025-01-06"]);
    expect(bestStreak(set)).toBe(2);
  });

  it("weekDates returns 7 days Mon-start", () => {
    const week = weekDates(new Date("2025-06-18T12:00:00Z"), "mon", TZ);
    expect(week.length).toBe(7);
    expect(iso(week[0], TZ)).toBe("2025-06-16");
    expect(iso(week[6], TZ)).toBe("2025-06-22");
  });

  it("weekDates respects Sun-start", () => {
    const week = weekDates(new Date("2025-06-18T12:00:00Z"), "sun", TZ);
    expect(iso(week[0], TZ)).toBe("2025-06-15");
    expect(iso(week[6], TZ)).toBe("2025-06-21");
  });

  it("currentAgendaIndex finds active event", () => {
    const times = ["08:00", "09:30", "11:00", "14:00"];
    expect(currentAgendaIndex(times, 7 * 60)).toBe(-1);
    expect(currentAgendaIndex(times, 8 * 60 + 15)).toBe(0);
    expect(currentAgendaIndex(times, 11 * 60 + 30)).toBe(2);
    expect(currentAgendaIndex(times, 15 * 60)).toBe(3);
  });
});

describe("parseOmni", () => {
  it("extracts tags and priority", () => {
    const r = parseOmni("review specs #work !high", tags);
    expect(r.tagIds).toContain("1");
    expect(r.priority).toBe("high");
    expect(r.title.toLowerCase()).not.toContain("#work");
  });

  it("detects tomorrow", () => {
    const ref = new Date("2026-06-21T12:00:00Z");
    const r = parseOmni("pay rent tomorrow", tags, ref, undefined, TZ);
    expect(r.due).toBe("2026-06-22");
    expect(r.dateLabel).toBeTruthy();
  });

  it("toggleTagInText adds and removes tags", () => {
    expect(toggleTagInText("buy milk", "work")).toBe("buy milk #work");
    expect(toggleTagInText("buy milk #work", "work")).toBe("buy milk");
  });
});

describe("parseNoteCapture", () => {
  const ref = new Date("2026-06-21T14:35:00");

  it("splits title and body on first colon", () => {
    const r = parseNoteCapture("Meeting ideas: discuss Q3 roadmap", tags, ref);
    expect(r.title).toBe("Meeting ideas");
    expect(r.body).toBe("discuss Q3 roadmap");
  });

  it("extracts tags and applies title: body", () => {
    const r = parseNoteCapture("Standup #work: action items from today", tags, ref);
    expect(r.title).toBe("Standup");
    expect(r.body).toBe("action items from today");
    expect(r.tagIds).toContain("1");
  });

  it("uses timestamped title when no colon", () => {
    const r = parseNoteCapture("quick thought about the app", tags, ref, TZ);
    expect(r.title).toBe(defaultNoteTitle(ref, TZ));
    expect(r.body).toBe("quick thought about the app");
  });

  it("does not treat dates in body as due dates", () => {
    const r = parseNoteCapture("Reminder: call dentist friday", tags, ref);
    expect(r.title).toBe("Reminder");
    expect(r.body).toBe("call dentist friday");
  });
});

describe("agenda timeline", () => {
  const items = [
    { id: "1", time: "08:00", title: "Run", sub: "habit", color: "", userId: "", lifeArea: "personal" as const },
    { id: "2", time: "09:30", title: "Standup", sub: "30 min", color: "", userId: "", lifeArea: "work" as const },
    { id: "3", time: "11:00", title: "Deep work", sub: "90 min block", color: "", userId: "", lifeArea: "work" as const },
  ];

  it("parses duration from sub", () => {
    expect(parseAgendaDurationMins("30 min")).toBe(30);
    expect(parseAgendaDurationMins("90 min block")).toBe(90);
    expect(parseAgendaDurationMins("personal")).toBeNull();
  });

  it("inserts dead time between events", () => {
    const blocks = buildAgendaBlocks(items);
    expect(blocks.some((b) => b.type === "dead")).toBe(true);
    const dead = blocks.find((b) => b.type === "dead");
    expect(dead?.type === "dead" && dead.nextTime).toBe("09:30");
  });

  it("places now line in event with progress", () => {
    const blocks = buildAgendaBlocks(items);
    const at = findNowPlacement(blocks, 9 * 60 + 45);
    expect(at.kind).toBe("event");
    if (at.kind === "event") {
      expect(at.progress).toBeCloseTo(0.5);
    }
  });

  it("places now line in dead time between events", () => {
    const blocks = buildAgendaBlocks(items);
    const at = findNowPlacement(blocks, 10 * 60 + 15);
    expect(at.kind).toBe("dead");
  });

  it("formats dead time label for active vs inactive gaps", () => {
    expect(formatDeadTimeLabel(8 * 60 + 30, 9 * 60 + 30, false, 0, "09:30")).toBe(
      "08:30 – 09:30"
    );
    expect(formatDeadTimeLabel(8 * 60 + 30, 9 * 60 + 30, true, 45, "09:30")).toBe(
      "45m until 09:30"
    );
  });
});

describe("metrics", () => {
  it("dayDonePercent blends tasks and habits", () => {
    const td = "2026-06-21";
    const pct = dayDonePercent(
      [
        {
          id: "t1",
          userId: "u",
          title: "a",
          description: "",
          subtasks: [],
          tagIds: [],
          priority: "med",
          status: "done",
          due: td,
          projectId: null,
          goalId: null,
          lifeArea: "personal",
          order: 0,
          createdAt: td,
          completedAt: td,
          timeSpentSec: 0,
          timerStartedAt: null,
        },
        {
          id: "t2",
          userId: "u",
          title: "b",
          description: "",
          subtasks: [],
          tagIds: [],
          priority: "med",
          status: "todo",
          due: td,
          projectId: null,
          goalId: null,
          lifeArea: "personal",
          order: 1,
          createdAt: td,
          completedAt: null,
          timeSpentSec: 0,
          timerStartedAt: null,
        },
      ],
      [{ id: "h1", userId: "u", name: "x", color: "", frequency: { type: "daily", target: 1 }, order: 0, archived: false, goalIds: [], lifeArea: "personal", goalTargetStreak: null, createdAt: td }],
      [{ id: "e1", habitId: "h1", date: td, done: true }],
      td
    );
    expect(pct).toBe(67);
  });
});

describe("habitHeatCells", () => {
  const visibility = DEFAULT_HABIT_VISIBILITY;
  const today = "2026-06-21";

  it("monthly habits show one cell per month", () => {
    const cells = habitHeatCells(
      "monthly",
      visibility,
      new Set(["2026-04-15", "2026-06-10"]),
      "mon",
      today
    );
    expect(cells).toHaveLength(3);
    expect(cells[0]?.done).toBe(true);
    expect(cells[1]?.done).toBe(false);
    expect(cells[2]?.done).toBe(true);
    expect(cells[2]?.isCurrent).toBe(true);
  });

  it("weekly habits show one cell per week", () => {
    const cells = habitHeatCells("weekly", visibility, new Set(), "mon", today);
    expect(cells).toHaveLength(8);
  });

  it("daily habits show one cell per day", () => {
    const cells = habitHeatCells("daily", visibility, new Set([today]), "mon", today);
    expect(cells).toHaveLength(30);
    expect(cells.at(-1)?.done).toBe(true);
  });
});
