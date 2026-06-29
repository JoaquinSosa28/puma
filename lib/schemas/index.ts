import { z } from "zod";
import { LIFE_SPAN_MAX } from "@/lib/life-constants";

export const userSchema = z.object({
  _id: z.string(),
  name: z.string(),
  email: z.string().optional(),
  createdAt: z.string(),
});

export const settingsSchema = z.object({
  _id: z.string(),
  userId: z.string(),
  theme: z.enum(["light", "dark"]),
  defaultCaptureType: z.enum(["task", "habit", "goal", "note"]),
  defaultDueToday: z.boolean(),
  weekStart: z.enum(["mon", "sun"]),
  birthDate: z.string().nullable().default(null),
  lifeSpanYears: z.number().default(LIFE_SPAN_MAX),
  lifeCalendarFullView: z.boolean().default(false),
  habitVisibleDays: z.number().min(1).default(30),
  habitVisibleWeeks: z.number().min(1).default(8),
  habitVisibleMonths: z.number().min(1).default(3),
});

export const tagSchema = z.object({
  _id: z.string(),
  name: z.string(),
  color: z.string(),
  isDefault: z.boolean(),
  order: z.number(),
  createdAt: z.string(),
});

export const subtaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  done: z.boolean(),
});

export const taskSchema = z.object({
  _id: z.string(),
  userId: z.string(),
  title: z.string(),
  description: z.string().default(""),
  subtasks: z.array(subtaskSchema).default([]),
  tagIds: z.array(z.string()),
  priority: z.enum(["low", "med", "high"]),
  status: z.enum(["todo", "doing", "done"]),
  due: z.string().nullable(),
  projectId: z.string().nullable(),
  goalId: z.string().nullable(),
  lifeArea: z.enum(["personal", "work"]),
  order: z.number(),
  createdAt: z.string(),
  completedAt: z.string().nullable(),
  timeSpentSec: z.number().default(0),
  timerStartedAt: z.string().nullable().default(null),
});

export const habitSchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object") return raw;
  const doc = raw as Record<string, unknown>;
  const goalIds = Array.isArray(doc.goalIds)
    ? doc.goalIds
    : doc.goalId
      ? [doc.goalId]
      : [];
  const { goalId: _legacy, ...rest } = doc;
  return { ...rest, goalIds };
}, z.object({
  _id: z.string(),
  userId: z.string(),
  name: z.string(),
  color: z.string(),
  frequency: z.object({ type: z.string(), target: z.number() }),
  order: z.number(),
  archived: z.boolean(),
  goalIds: z.array(z.string()).default([]),
  goalTargetStreak: z.number().nullable().default(null),
  lifeArea: z.enum(["personal", "work"]),
  createdAt: z.string(),
}));

export const habitEntrySchema = z.object({
  _id: z.string(),
  habitId: z.string(),
  date: z.string(),
  done: z.boolean(),
});

export const noteSchema = z.object({
  _id: z.string(),
  userId: z.string(),
  title: z.string(),
  body: z.string(),
  tagIds: z.array(z.string()),
  pinned: z.boolean(),
  lifeArea: z.enum(["personal", "work"]),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const goalSchema = z.object({
  _id: z.string(),
  userId: z.string(),
  title: z.string(),
  category: z.enum(["personal", "professional"]),
  metricLabel: z.string(),
  progress: z.number().min(0).max(100),
  targetDate: z.string().nullable(),
  lifeArea: z.enum(["personal", "work"]),
  order: z.number().default(0),
  createdAt: z.string(),
});

export const projectSchema = z.object({
  _id: z.string(),
  userId: z.string(),
  title: z.string(),
  description: z.string().default(""),
  color: z.string(),
  progress: z.number(),
  label: z.string(),
  goalId: z.string().nullable(),
  lifeArea: z.enum(["personal", "work"]),
  createdAt: z.string(),
});

export const agendaItemSchema = z.object({
  _id: z.string(),
  userId: z.string(),
  time: z.string(),
  title: z.string(),
  sub: z.string(),
  color: z.string(),
  now: z.boolean().optional(),
  lifeArea: z.enum(["personal", "work"]),
});

export const lifeMoodSchema = z.enum(["great", "good", "okay", "low", "rough"]);

export const lifeDaySchema = z.object({
  _id: z.string(),
  userId: z.string(),
  date: z.string(),
  note: z.string().default(""),
  mood: lifeMoodSchema.nullable().default(null),
  updatedAt: z.string(),
});

export const lifeWeekSchema = z.object({
  _id: z.string(),
  userId: z.string(),
  weekStart: z.string(),
  note: z.string().default(""),
  mood: lifeMoodSchema.nullable().default(null),
  updatedAt: z.string(),
});

export type UserDoc = z.infer<typeof userSchema>;
export type SettingsDoc = z.infer<typeof settingsSchema>;
export type TagDoc = z.infer<typeof tagSchema>;
export type Subtask = z.infer<typeof subtaskSchema>;
export type TaskDoc = z.infer<typeof taskSchema>;
export type HabitDoc = z.infer<typeof habitSchema>;
export type HabitEntryDoc = z.infer<typeof habitEntrySchema>;
export type NoteDoc = z.infer<typeof noteSchema>;
export type GoalDoc = z.infer<typeof goalSchema>;
export type ProjectDoc = z.infer<typeof projectSchema>;
export type AgendaItemDoc = z.infer<typeof agendaItemSchema>;
export type LifeDayDoc = z.infer<typeof lifeDaySchema>;
export type LifeWeekDoc = z.infer<typeof lifeWeekSchema>;
export type LifeMood = z.infer<typeof lifeMoodSchema>;

export type User = Omit<UserDoc, "_id"> & { id: string };
export type Settings = Omit<SettingsDoc, "_id"> & { id: string };
export type Tag = Omit<TagDoc, "_id"> & { id: string };
export type Task = Omit<TaskDoc, "_id"> & { id: string };
export type Habit = Omit<HabitDoc, "_id"> & { id: string };
export type HabitEntry = Omit<HabitEntryDoc, "_id"> & { id: string };
export type Note = Omit<NoteDoc, "_id"> & { id: string };
export type Goal = Omit<GoalDoc, "_id"> & { id: string };
export type Project = Omit<ProjectDoc, "_id"> & { id: string };
export type AgendaItem = Omit<AgendaItemDoc, "_id"> & { id: string };
export type LifeDay = Omit<LifeDayDoc, "_id"> & { id: string };
export type LifeWeek = Omit<LifeWeekDoc, "_id"> & { id: string };

export function toDto<T extends { _id: string }>(
  doc: T
): Omit<T, "_id"> & { id: string } {
  const { _id, ...rest } = doc;
  return { ...rest, id: _id } as Omit<T, "_id"> & { id: string };
}
