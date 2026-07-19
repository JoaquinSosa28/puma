// First-login provisioning: every new account gets its own app-user doc,
// settings, and starter tag — NOT the demo seed.
import "server-only";
import { insertUser } from "@/lib/db/users";
import { insertSettings } from "@/lib/db/settings";
import { ensureDefaultTag } from "@/lib/db/tags";
import { LIFE_SPAN_MAX } from "@/lib/life-constants";
import { iso } from "@/lib/date";

export async function bootstrapNewUser(user: {
  id: string;
  name?: string | null;
  email?: string | null;
}): Promise<void> {
  const today = iso();
  await insertUser({
    _id: user.id,
    name: user.name?.trim() || "there",
    email: user.email ?? undefined,
    createdAt: today,
  });
  await insertSettings({
    userId: user.id,
    theme: "light",
    defaultCaptureType: "task",
    defaultDueToday: true,
    weekStart: "mon",
    birthDate: null,
    lifeSpanYears: LIFE_SPAN_MAX,
    lifeCalendarFullView: false,
    habitVisibleDays: 30,
    habitVisibleWeeks: 8,
    habitVisibleMonths: 3,
    timezone: "UTC", // refined by the client TimezoneSync cookie on first load
    aiApiKeyEnc: null,
    aiApiKeyLast4: null,
    lifeAutoSwitch: false,
    workStart: "09:00",
    workEnd: "18:00",
    workDays: [1, 2, 3, 4, 5],
    lifeAutoOverrideMins: 60,
  });
  await ensureDefaultTag(user.id);
}
