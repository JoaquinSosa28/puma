"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/types";
import { requireUserId } from "@/lib/auth/session";
import { userToday } from "@/lib/timezone-server";
import { entityId, isoDate, title } from "@/lib/validation";
import { deleteHabit, insertHabit, updateHabit } from "@/lib/db/habits";
import { toggleHabitEntry } from "@/lib/db/habitEntries";

export async function toggleHabitToday(habitId: string): Promise<ActionResult> {
  const parsed = entityId.safeParse(habitId);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const userId = await requireUserId();
  const { today: td } = await userToday();
  await toggleHabitEntry(userId, parsed.data, td);
  revalidatePath("/", "layout");
  return { ok: true };
}

const toggleDateSchema = z.object({ habitId: entityId, date: isoDate });

export async function toggleHabitDate(
  habitId: string,
  date: string
): Promise<ActionResult> {
  const parsed = toggleDateSchema.safeParse({ habitId, date });
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const userId = await requireUserId();
  await toggleHabitEntry(userId, parsed.data.habitId, parsed.data.date);
  revalidatePath("/", "layout");
  return { ok: true };
}

const nameSchema = z.object({ name: title });

export async function addHabitAction(
  input: z.infer<typeof nameSchema>
): Promise<ActionResult> {
  const parsed = nameSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid name" };
  const userId = await requireUserId();
  const { today: td } = await userToday();
  await insertHabit({
    userId,
    name: parsed.data.name,
    color: "oklch(0.6 0.13 155)",
    frequency: { type: "daily", target: 1 },
    order: 999,
    archived: false,
    goalIds: [],
    goalTargetStreak: null,
    lifeArea: "personal",
    createdAt: td,
  });
  revalidatePath("/", "layout");
  return { ok: true };
}

const renameSchema = z.object({ id: entityId, name: title });

export async function renameHabit(
  id: string,
  name: string
): Promise<ActionResult> {
  const parsed = renameSchema.safeParse({ id, name });
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const userId = await requireUserId();
  await updateHabit(userId, parsed.data.id, { name: parsed.data.name });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function archiveHabit(id: string): Promise<ActionResult> {
  const parsed = entityId.safeParse(id);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const userId = await requireUserId();
  const { listHabits } = await import("@/lib/db/habits");
  const habits = await listHabits(userId);
  const h = habits.find((x) => x.id === parsed.data);
  if (!h) return { ok: false, error: "Not found" };
  await updateHabit(userId, parsed.data, { archived: !h.archived });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteHabitAction(id: string): Promise<ActionResult> {
  const parsed = entityId.safeParse(id);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const userId = await requireUserId();
  // Permanently removes the habit AND its entry history (unlike archive).
  const deleted = await deleteHabit(userId, parsed.data);
  if (!deleted) return { ok: false, error: "Not found" };
  revalidatePath("/", "layout");
  return { ok: true };
}

const frequencySchema = z.object({
  type: z.enum(["daily", "weekly", "monthly"]),
  target: z.number().min(1).max(31).optional(),
});

export async function updateHabitFrequencyAction(
  id: string,
  frequency: z.infer<typeof frequencySchema>
): Promise<ActionResult> {
  const idParsed = entityId.safeParse(id);
  const parsed = frequencySchema.safeParse(frequency);
  if (!idParsed.success || !parsed.success) {
    return { ok: false, error: "Invalid input" };
  }
  const userId = await requireUserId();
  await updateHabit(userId, idParsed.data, {
    frequency: {
      type: parsed.data.type,
      target: parsed.data.target ?? 1,
    },
  });
  revalidatePath("/", "layout");
  return { ok: true };
}
