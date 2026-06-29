"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/types";
import { getCurrentUserId } from "@/lib/store/memory";
import { userToday } from "@/lib/timezone-server";
import { insertHabit, updateHabit } from "@/lib/db/habits";
import { toggleHabitEntry } from "@/lib/db/habitEntries";

export async function toggleHabitToday(habitId: string): Promise<ActionResult> {
  const { today: td } = await userToday();
  await toggleHabitEntry(habitId, td);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function toggleHabitDate(
  habitId: string,
  date: string
): Promise<ActionResult> {
  await toggleHabitEntry(habitId, date);
  revalidatePath("/", "layout");
  return { ok: true };
}

const nameSchema = z.object({ name: z.string().min(1) });

export async function addHabitAction(
  input: z.infer<typeof nameSchema>
): Promise<ActionResult> {
  const parsed = nameSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid name" };
  const userId = getCurrentUserId();
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

export async function renameHabit(
  id: string,
  name: string
): Promise<ActionResult> {
  if (!name.trim()) return { ok: false, error: "Empty name" };
  await updateHabit(id, { name: name.trim() });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function archiveHabit(id: string): Promise<ActionResult> {
  const { listHabits } = await import("@/lib/db/habits");
  const habits = await listHabits();
  const h = habits.find((x) => x.id === id);
  if (!h) return { ok: false, error: "Not found" };
  await updateHabit(id, { archived: !h.archived });
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
  const parsed = frequencySchema.safeParse(frequency);
  if (!parsed.success) return { ok: false, error: "Invalid frequency" };
  await updateHabit(id, {
    frequency: {
      type: parsed.data.type,
      target: parsed.data.target ?? 1,
    },
  });
  revalidatePath("/", "layout");
  return { ok: true };
}
