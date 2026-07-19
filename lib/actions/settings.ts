"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult, Theme, OmniType } from "@/lib/types";
import type { Tag } from "@/lib/schemas";
import { updateSettings } from "@/lib/db/settings";
import { insertTag } from "@/lib/db/tags";
import { updateUser } from "@/lib/db/users";
import { requireUserId } from "@/lib/auth/session";
import { persistTimezoneCookie } from "@/lib/timezone-server";
import { isValidTimezone, normalizeTimezone } from "@/lib/timezone";
import { isoDate, tagName } from "@/lib/validation";
import { LIFE_SPAN_MAX } from "@/lib/life-constants";

const themeSchema = z.enum(["light", "dark"]);

export async function setTheme(theme: Theme): Promise<ActionResult> {
  const parsed = themeSchema.safeParse(theme);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const userId = await requireUserId();
  await updateSettings(userId, { theme: parsed.data });
  revalidatePath("/", "layout");
  return { ok: true };
}

// .strict() so unexpected keys (e.g. crafted `$`-prefixed fields) are rejected
// before they can reach the data layer's $set.
const settingsPatchSchema = z
  .object({
    defaultCaptureType: z.enum(["task", "habit", "goal", "note"]).optional(),
    defaultDueToday: z.boolean().optional(),
    weekStart: z.enum(["mon", "sun"]).optional(),
    birthDate: isoDate.nullable().optional(),
    lifeSpanYears: z.number().int().min(1).max(LIFE_SPAN_MAX).optional(),
    lifeCalendarFullView: z.boolean().optional(),
    habitVisibleDays: z.number().int().min(1).max(365).optional(),
    habitVisibleWeeks: z.number().int().min(1).max(52).optional(),
    habitVisibleMonths: z.number().int().min(1).max(24).optional(),
    timezone: z.string().max(64).optional(),
    lifeAutoSwitch: z.boolean().optional(),
    workStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
    workEnd: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
    workDays: z.array(z.number().int().min(0).max(6)).max(7).optional(),
    lifeAutoOverrideMins: z.number().int().min(5).max(720).optional(),
  })
  .strict();

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
  lifeAutoSwitch?: boolean;
  workStart?: string;
  workEnd?: string;
  workDays?: number[];
  lifeAutoOverrideMins?: number;
}): Promise<ActionResult> {
  const parsed = settingsPatchSchema.safeParse(patch);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const data = parsed.data;

  const userId = await requireUserId();
  if (data.timezone !== undefined) {
    if (!isValidTimezone(data.timezone)) {
      return { ok: false, error: "Invalid timezone." };
    }
    data.timezone = normalizeTimezone(data.timezone);
    await persistTimezoneCookie(data.timezone);
  }
  await updateSettings(userId, data);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function addTagAction(name: string): Promise<ActionResult<Tag>> {
  const parsed = tagName.safeParse(name.toLowerCase());
  if (!parsed.success) return { ok: false, error: "Invalid name" };
  const userId = await requireUserId();
  const tag = await insertTag(userId, parsed.data);
  if (!tag) return { ok: false, error: "Tag already exists" };
  revalidatePath("/", "layout");
  return { ok: true, data: tag };
}

// Anthropic keys look like `sk-ant-...`; accept a generous charset and length
// so future key formats don't get falsely rejected, but reject obvious garbage.
const apiKeySchema = z
  .string()
  .trim()
  .regex(/^sk-ant-[A-Za-z0-9_-]{16,200}$/, "That doesn't look like an Anthropic API key (sk-ant-…).");

/** Store the user's own Claude key, encrypted. We keep only the last 4 chars in
 *  plaintext so the UI can show which key is set. */
export async function setAiApiKeyAction(rawKey: string): Promise<ActionResult> {
  const parsed = apiKeySchema.safeParse(rawKey);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid API key" };
  }
  const key = parsed.data;
  const { encryptSecret } = await import("@/lib/crypto");
  const userId = await requireUserId();
  await updateSettings(userId, {
    aiApiKeyEnc: encryptSecret(key),
    aiApiKeyLast4: key.slice(-4),
  });
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Remove the stored key — Plan/Ask stop working until a new key is added.
 *  Hosted (mongodb) accounts have no server-key fallback by design; only
 *  memory-mode local dev falls back to the shared env key. */
export async function clearAiApiKeyAction(): Promise<ActionResult> {
  const userId = await requireUserId();
  await updateSettings(userId, { aiApiKeyEnc: null, aiApiKeyLast4: null });
  revalidatePath("/", "layout");
  return { ok: true };
}

const userNameSchema = z.string().trim().min(1).max(64);

export async function updateUserNameAction(name: string): Promise<ActionResult> {
  const parsed = userNameSchema.safeParse(name);
  if (!parsed.success) return { ok: false, error: "Invalid name" };

  const userId = await requireUserId();
  const updated = await updateUser(userId, { name: parsed.data });
  if (!updated) return { ok: false, error: "User not found" };

  revalidatePath("/", "layout");
  return { ok: true };
}
