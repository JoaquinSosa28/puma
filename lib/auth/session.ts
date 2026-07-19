// The single seam every server action / data loader uses to learn who's asking.
// mongodb mode → real Better Auth session (redirects to /login when absent).
// memory mode  → the demo user (keeps local demo + tests working without auth).
import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUserId as demoUserId } from "@/lib/store/memory";

const AUTH_ACTIVE = () => process.env.DATA_SOURCE === "mongodb";

/** Whether real sessions exist (mongodb mode). Memory mode has no auth to sign
 *  out of, so the UI hides account/sign-out controls. */
export function isAuthEnabled(): boolean {
  return AUTH_ACTIVE();
}

/** Session user id, or null when unauthenticated. Deduped per request. */
export const getSessionUserId = cache(async (): Promise<string | null> => {
  const user = await getSessionUser();
  return user?.id ?? null;
});

/** Session user id + email, or null. Deduped per request. */
export const getSessionUser = cache(
  async (): Promise<{ id: string; email: string | null } | null> => {
    if (!AUTH_ACTIVE()) return { id: demoUserId(), email: null };
    const { getAuth } = await import("@/lib/auth");
    const session = await getAuth().api.getSession({ headers: await headers() });
    return session
      ? { id: session.user.id, email: session.user.email ?? null }
      : null;
  }
);

/** Session user id or redirect to /login. Use at the top of pages/actions. */
export async function requireUserId(): Promise<string> {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");
  return userId;
}
