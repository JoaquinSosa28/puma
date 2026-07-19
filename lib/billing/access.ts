// Who gets into the app: owners (allowlist), active subscribers, and live
// demo accounts. Everything is opt-in behind BILLING_ENABLED so local dev and
// pre-billing deployments behave exactly as before.
import "server-only";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/db/users";
import { getSubscriptionByUserId } from "@/lib/db/subscriptions";
import { requireUserId } from "@/lib/auth/session";

export type AccessLevel = "owner" | "subscribed" | "demo" | "none";

export function billingEnabled(): boolean {
  return process.env.BILLING_ENABLED === "1";
}

function ownerEmails(): string[] {
  return (process.env.OWNER_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export async function getAccessLevel(userId: string): Promise<AccessLevel> {
  // Gate off → everyone who has an account is treated as an owner.
  if (!billingEnabled()) return "owner";

  const user = await getUser(userId);
  if (user?.email && ownerEmails().includes(user.email.toLowerCase())) {
    return "owner";
  }
  if (user?.isDemo) {
    const live = user.demoExpiresAt && user.demoExpiresAt > new Date().toISOString();
    return live ? "demo" : "none";
  }
  const sub = await getSubscriptionByUserId(userId);
  // past_due keeps access as a grace period while the provider retries payment.
  if (sub && ["active", "trialing", "past_due"].includes(sub.status)) {
    return "subscribed";
  }
  return "none";
}

/** App-shell gate: authenticated but unpaid users land on /billing. */
export async function requireAccess(): Promise<AccessLevel> {
  const userId = await requireUserId();
  const level = await getAccessLevel(userId);
  if (level === "none") redirect("/billing");
  return level;
}
