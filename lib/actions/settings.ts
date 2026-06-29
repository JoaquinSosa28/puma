"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult, Theme, OmniType } from "@/lib/types";
import type { Tag } from "@/lib/schemas";
import { updateSettings } from "@/lib/db/settings";
import { insertTag } from "@/lib/db/tags";
import { updateUser } from "@/lib/db/users";
import { getCurrentUserId } from "@/lib/store/memory";
import { persistTimezoneCookie } from "@/lib/timezone-server";
import { isValidTimezone, normalizeTimezone } from "@/lib/timezone";

export async function setTheme(theme: Theme): Promise<ActionResult> {
  const userId = getCurrentUserId();
  await updateSettings(userId, { theme });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateSettingsAction(patch: {
  defaultCaptureType?: OmniType;
  defaultDueToday?: boolean;
  weekStart?: "mon" | "sun";
  birthDate?: string | null;
  lifeSpanYears?: number;
  lifeCalendarFullView?: boolean;
  habitVisibleDays?: number;
  habitVisibleWeeks?: number;
  habitVisibleMonths?: number;
  timezone?: string;
}): Promise<ActionResult> {
  const userId = getCurrentUserId();
  if (patch.timezone !== undefined) {
    if (!isValidTimezone(patch.timezone)) {
      return { ok: false, error: "Invalid timezone." };
    }
    patch.timezone = normalizeTimezone(patch.timezone);
    await persistTimezoneCookie(patch.timezone);
  }
  await updateSettings(userId, patch);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function addTagAction(name: string): Promise<ActionResult<Tag>> {
  const nm = name.trim().toLowerCase();
  if (!nm) return { ok: false, error: "Empty name" };
  const tag = await insertTag(nm);
  if (!tag) return { ok: false, error: "Tag already exists" };
  revalidatePath("/", "layout");
  return { ok: true, data: tag };
}

export async function updateUserNameAction(name: string): Promise<ActionResult> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Name cannot be empty" };
  if (trimmed.length > 64) return { ok: false, error: "Name is too long" };

  const userId = getCurrentUserId();
  const updated = await updateUser(userId, { name: trimmed });
  if (!updated) return { ok: false, error: "User not found" };

  revalidatePath("/", "layout");
  return { ok: true };
}
