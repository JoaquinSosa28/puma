"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/types";
import type { AgendaItem } from "@/lib/schemas";
import { insertAgendaItem, deleteAgendaItem } from "@/lib/db/agenda";
import { requireUserId } from "@/lib/auth/session";
import { entityId, isoDate, title } from "@/lib/validation";

const MEETING_COLORS = {
  work: "oklch(0.58 0.14 245)",
  personal: "oklch(0.58 0.17 300)",
} as const;

const meetingSchema = z
  .object({
    title,
    date: isoDate,
    time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Invalid time"),
    durationMins: z.number().int().min(5).max(600),
    lifeArea: z.enum(["personal", "work"]),
  })
  .strict();

export async function addMeetingAction(input: {
  title: string;
  date: string;
  time: string;
  durationMins: number;
  lifeArea: "personal" | "work";
}): Promise<ActionResult<AgendaItem>> {
  const parsed = meetingSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  const { title: t, date, time, durationMins, lifeArea } = parsed.data;
  const userId = await requireUserId();
  const item = await insertAgendaItem({
    userId,
    title: t,
    time,
    // The timeline derives block length from "N min" in the sub text.
    sub: `meeting · ${durationMins} min`,
    color: MEETING_COLORS[lifeArea],
    lifeArea,
    date,
    kind: "meeting",
  });
  revalidatePath("/", "layout");
  return { ok: true, data: item };
}

export async function deleteAgendaItemAction(id: string): Promise<ActionResult> {
  const parsed = entityId.safeParse(id);
  if (!parsed.success) return { ok: false, error: "Invalid id" };
  const userId = await requireUserId();
  const ok = await deleteAgendaItem(userId, parsed.data);
  if (!ok) return { ok: false, error: "Item not found" };
  revalidatePath("/", "layout");
  return { ok: true };
}
