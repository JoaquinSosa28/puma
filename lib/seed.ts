import type {
  AgendaItemDoc,
  GoalDoc,
  HabitDoc,
  HabitEntryDoc,
  LifeDayDoc,
  LifeWeekDoc,
  NoteDoc,
  ProjectDoc,
  SettingsDoc,
  TagDoc,
  TaskDoc,
  UserDoc,
} from "@/lib/schemas";
import { taskSchema } from "@/lib/schemas";
import { LIFE_SPAN_MAX } from "@/lib/life-constants";
import { addDays, iso, oid } from "@/lib/date";

export type SeedData = {
  users: UserDoc[];
  settings: SettingsDoc[];
  tags: TagDoc[];
  tasks: TaskDoc[];
  habits: HabitDoc[];
  habitEntries: HabitEntryDoc[];
  notes: NoteDoc[];
  goals: GoalDoc[];
  projects: ProjectDoc[];
  agenda: AgendaItemDoc[];
  lifeDays: LifeDayDoc[];
  lifeWeeks: LifeWeekDoc[];
};

export function createSeedData(userId: string): SeedData {
  const td = iso();
  const yd = iso(addDays(-1));

  const tagDefs: [string, string, boolean][] = [
    ["note", "#8a8580", true],
    ["idea", "oklch(0.58 0.17 300)", false],
    ["work", "oklch(0.58 0.14 245)", false],
    ["health", "oklch(0.6 0.13 155)", false],
    ["finance", "oklch(0.7 0.12 70)", false],
    ["personal", "oklch(0.55 0.16 274)", false],
  ];

  const tags: TagDoc[] = tagDefs.map((t, i) => ({
    _id: oid(),
    userId,
    name: t[0],
    color: t[1],
    isDefault: t[2],
    order: i,
    createdAt: td,
  }));

  const T = (n: string) => tags.find((x) => x.name === n)!._id;

  const projects: ProjectDoc[] = [
    {
      _id: oid(),
      userId,
      title: "Website redesign",
      description:
        "Refresh marketing site — new typography, case studies, and a faster contact flow.",
      color: "oklch(0.58 0.14 245)",
      progress: 80,
      label: "16/20",
      goalId: null,
      lifeArea: "personal",
      createdAt: td,
    },
    {
      _id: oid(),
      userId,
      title: "Learn Spanish",
      description: "Reach B1 by end of year. Focus on conversation + Anki daily.",
      color: "oklch(0.58 0.17 300)",
      progress: 45,
      label: "B1 · u9",
      goalId: null,
      lifeArea: "personal",
      createdAt: td,
    },
    {
      _id: oid(),
      userId,
      title: "Home office setup",
      description: "Standing desk, lighting, and cable management.",
      color: "oklch(0.6 0.13 155)",
      progress: 60,
      label: "6/10",
      goalId: null,
      lifeArea: "personal",
      createdAt: td,
    },
    {
      _id: oid(),
      userId,
      title: "Side app MVP",
      description: "Ship a minimal life-OS prototype for friends to try.",
      color: "oklch(0.64 0.18 25)",
      progress: 28,
      label: "7/25",
      goalId: null,
      lifeArea: "personal",
      createdAt: td,
    },
  ];

  const tasks = [
    {
      _id: oid(),
      userId,
      title: "Review Q3 OKRs draft",
      tagIds: [T("work")],
      priority: "med",
      status: "done",
      due: td,
      projectId: null,
      goalId: null,
      lifeArea: "personal",
      order: 0,
      createdAt: td,
      completedAt: td,
    },
    {
      _id: oid(),
      userId,
      title: "Morning run · 5k",
      tagIds: [T("health")],
      priority: "low",
      status: "done",
      due: td,
      projectId: null,
      goalId: null,
      lifeArea: "personal",
      order: 1,
      createdAt: td,
      completedAt: td,
    },
    {
      _id: oid(),
      userId,
      title: "Draft launch email to beta list",
      description:
        "Highlight the new capture flow and life calendar. Keep it under 200 words.",
      subtasks: [
        { id: oid(), title: "Write subject line options", done: true },
        { id: oid(), title: "Pull beta metrics snippet", done: false },
        { id: oid(), title: "Proofread and schedule", done: false },
      ],
      tagIds: [T("work")],
      priority: "high",
      status: "todo",
      due: td,
      projectId: projects[0]._id,
      goalId: null,
      lifeArea: "personal",
      order: 2,
      createdAt: td,
      completedAt: null,
    },
    {
      _id: oid(),
      userId,
      title: "Call Mom",
      tagIds: [T("personal")],
      priority: "med",
      status: "todo",
      due: td + "T14:00",
      projectId: null,
      goalId: null,
      lifeArea: "personal",
      order: 3,
      createdAt: td,
      completedAt: null,
    },
    {
      _id: oid(),
      userId,
      title: "Finish ch. 4 — Atomic Habits",
      tagIds: [T("idea")],
      priority: "low",
      status: "todo",
      due: td,
      projectId: null,
      goalId: null,
      lifeArea: "personal",
      order: 4,
      createdAt: td,
      completedAt: null,
    },
    {
      _id: oid(),
      userId,
      title: "Send invoice to client",
      tagIds: [T("work"), T("finance")],
      priority: "high",
      status: "todo",
      due: yd,
      projectId: null,
      goalId: null,
      lifeArea: "personal",
      order: 5,
      createdAt: yd,
      completedAt: null,
    },
    {
      _id: oid(),
      userId,
      title: "Reply to Sam's email",
      tagIds: [],
      priority: "med",
      status: "todo",
      due: yd,
      projectId: null,
      goalId: null,
      lifeArea: "personal",
      order: 6,
      createdAt: yd,
      completedAt: null,
    },
    {
      _id: oid(),
      userId,
      title: "Pay rent",
      tagIds: [T("finance")],
      priority: "high",
      status: "todo",
      due: iso(addDays(1)),
      projectId: null,
      goalId: null,
      lifeArea: "personal",
      order: 7,
      createdAt: td,
      completedAt: null,
    },
    {
      _id: oid(),
      userId,
      title: "Review PR #214",
      tagIds: [T("work")],
      priority: "med",
      status: "todo",
      due: iso(addDays(1)),
      projectId: projects[3]._id,
      goalId: null,
      lifeArea: "personal",
      order: 8,
      createdAt: td,
      completedAt: null,
    },
    {
      _id: oid(),
      userId,
      title: "Book dentist",
      tagIds: [T("health")],
      priority: "low",
      status: "todo",
      due: iso(addDays(2)),
      projectId: null,
      goalId: null,
      lifeArea: "personal",
      order: 9,
      createdAt: td,
      completedAt: null,
    },
    {
      _id: oid(),
      userId,
      title: "Wireframe new homepage",
      tagIds: [T("work")],
      priority: "med",
      status: "done",
      due: iso(addDays(-3)),
      projectId: projects[0]._id,
      goalId: null,
      lifeArea: "personal",
      order: 10,
      createdAt: yd,
      completedAt: yd,
    },
    {
      _id: oid(),
      userId,
      title: "Design system audit",
      tagIds: [T("work")],
      priority: "med",
      status: "done",
      due: iso(addDays(-1)),
      projectId: projects[0]._id,
      goalId: null,
      lifeArea: "personal",
      order: 11,
      createdAt: yd,
      completedAt: yd,
    },
    {
      _id: oid(),
      userId,
      title: "Build hero section",
      tagIds: [T("work")],
      priority: "high",
      status: "doing",
      due: td,
      projectId: projects[0]._id,
      goalId: null,
      lifeArea: "personal",
      order: 12,
      createdAt: td,
      completedAt: null,
    },
    {
      _id: oid(),
      userId,
      title: "Migrate blog templates",
      tagIds: [T("work")],
      priority: "low",
      status: "todo",
      due: iso(addDays(3)),
      projectId: projects[0]._id,
      goalId: null,
      lifeArea: "personal",
      order: 13,
      createdAt: td,
      completedAt: null,
    },
    {
      _id: oid(),
      userId,
      title: "Set up CI pipeline",
      tagIds: [],
      priority: "med",
      status: "doing",
      due: iso(addDays(2)),
      projectId: projects[3]._id,
      goalId: null,
      lifeArea: "personal",
      order: 14,
      createdAt: td,
      completedAt: null,
    },
    {
      _id: oid(),
      userId,
      title: "Sketch onboarding flow",
      tagIds: [T("idea")],
      priority: "low",
      status: "todo",
      due: iso(addDays(4)),
      projectId: projects[3]._id,
      goalId: null,
      lifeArea: "personal",
      order: 15,
      createdAt: td,
      completedAt: null,
    },
  ];

  const habitDefs: [string, string, number, boolean][] = [
    ["Meditate", "daily", 12, true],
    ["Run / move", "daily", 5, true],
    ["Read 20 min", "daily", 3, true],
    ["Journal", "daily", 4, true],
    ["No phone post-10pm", "daily", 2, false],
    ["Drink 2L water", "daily", 4, false],
    ["Weekly review", "weekly", 8, true],
    ["Budget check", "monthly", 3, true],
  ];

  const habits: HabitDoc[] = [];
  const habitEntries: HabitEntryDoc[] = [];

  habitDefs.forEach((h, i) => {
    const id = oid();
    habits.push({
      _id: id,
      userId,
      name: h[0],
      color: "oklch(0.6 0.13 155)",
      frequency: { type: h[1], target: 1 },
      order: i,
      archived: false,
      goalIds: [],
      goalTargetStreak: null,
      lifeArea: "personal",
      createdAt: td,
    });
    const start = h[3] ? 0 : 1;
    const len = h[2];
    for (let k = start; k < start + len; k++) {
      habitEntries.push({
        _id: oid(),
        userId,
        habitId: id,
        date: iso(addDays(-k)),
        done: true,
      });
    }
  });

  const goals: GoalDoc[] = [
    {
      _id: oid(),
      userId,
      title: "Run a half marathon",
      category: "personal",
      metricLabel: "",
      progress: 72,
      targetDate: null,
      lifeArea: "personal",
      order: 0,
      createdAt: td,
    },
    {
      _id: oid(),
      userId,
      title: "Ship v2.0 release",
      category: "professional",
      metricLabel: "",
      progress: 54,
      targetDate: null,
      lifeArea: "personal",
      order: 0,
      createdAt: td,
    },
    {
      _id: oid(),
      userId,
      title: "Save $10k buffer",
      category: "personal",
      metricLabel: "",
      progress: 40,
      targetDate: null,
      lifeArea: "personal",
      order: 1,
      createdAt: td,
    },
  ];

  projects[0].goalId = goals[1]._id;
  projects[0].lifeArea = "work";
  projects[3].lifeArea = "work";
  goals[1].lifeArea = "work";

  const workTagId = T("work");
  for (const task of tasks) {
    if (
      task.tagIds.includes(workTagId) ||
      task.projectId === projects[0]._id ||
      task.projectId === projects[3]._id
    ) {
      task.lifeArea = "work";
    }
  }

  const runHabit = habits.find((h) => h.name === "Run / move");
  if (runHabit) {
    runHabit.goalIds = [goals[0]._id];
    runHabit.goalTargetStreak = 30;
  }

  const notes: NoteDoc[] = [
    {
      _id: oid(),
      userId,
      title: "Podcast idea: interview solo founders",
      body: "30-min audio format. Pull guests from DMs.",
      tagIds: [T("idea")],
      pinned: false,
      lifeArea: "personal",
      createdAt: td,
      updatedAt: td,
    },
    {
      _id: oid(),
      userId,
      title: "Gift ideas for Sam's birthday",
      body: "Books, that lamp she liked, a weekend trip.",
      tagIds: [T("note")],
      pinned: false,
      lifeArea: "personal",
      createdAt: yd,
      updatedAt: yd,
    },
    {
      _id: oid(),
      userId,
      title: "Pricing experiment results",
      body: "Annual plan converted 1.8x better at $9/mo.",
      tagIds: [T("work")],
      pinned: false,
      lifeArea: "work",
      createdAt: iso(addDays(-2)),
      updatedAt: iso(addDays(-2)),
    },
  ];

  // Routine template rows (date null); dated meetings are user-created.
  const agendaBase = { date: null, kind: "routine" as const };
  const agenda: AgendaItemDoc[] = [
    {
      _id: oid(),
      userId,
      time: "08:00",
      title: "Morning run · 5k",
      sub: "habit · done",
      color: "oklch(0.6 0.13 155)",
      lifeArea: "personal",
      ...agendaBase,
    },
    {
      _id: oid(),
      userId,
      time: "09:30",
      title: "Standup + planning",
      sub: "work · 30 min",
      color: "oklch(0.58 0.14 245)",
      lifeArea: "work",
      ...agendaBase,
    },
    {
      _id: oid(),
      userId,
      time: "11:00",
      title: "Deep work · launch email",
      sub: "now · 90 min block",
      color: "oklch(0.64 0.18 25)",
      now: true,
      lifeArea: "work",
      ...agendaBase,
    },
    {
      _id: oid(),
      userId,
      time: "14:00",
      title: "Call Mom",
      sub: "personal",
      color: "#b3aea7",
      lifeArea: "personal",
      ...agendaBase,
    },
    {
      _id: oid(),
      userId,
      time: "19:00",
      title: "Spanish · unit 9",
      sub: "project · 20 min",
      color: "oklch(0.58 0.17 300)",
      lifeArea: "personal",
      ...agendaBase,
    },
  ];

  const user: UserDoc = {
    _id: userId,
    name: "Ignis",
    email: "alex@example.com",
    createdAt: td,
  };

  const settings: SettingsDoc = {
    _id: oid(),
    userId,
    theme: "light",
    defaultCaptureType: "task",
    defaultDueToday: true,
    weekStart: "mon",
    birthDate: "1997-06-15",
    lifeSpanYears: LIFE_SPAN_MAX,
    lifeCalendarFullView: false,
    habitVisibleDays: 30,
    habitVisibleWeeks: 8,
    habitVisibleMonths: 3,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    aiApiKeyEnc: null,
    aiApiKeyLast4: null,
    lifeAutoSwitch: false,
    workStart: "09:00",
    workEnd: "18:00",
    workDays: [1, 2, 3, 4, 5],
    lifeAutoOverrideMins: 60,
  };

  return {
    users: [user],
    settings: [settings],
    tags,
    tasks: tasks.map((t) => taskSchema.parse(t)),
    habits,
    habitEntries,
    notes,
    goals,
    projects,
    agenda,
    lifeDays: [],
    lifeWeeks: [],
  };
}
