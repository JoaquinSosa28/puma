// Pure, backend-agnostic user display helpers.
// Lives outside lib/db/* so client components and shared utils (e.g. lib/date.ts)
// can use it without dragging the data layer — and the MongoDB driver — into the
// client bundle.

export const DEFAULT_USER_NAME = "Ignis";

export function displayName(user: { name: string } | null | undefined): string {
  const name = user?.name?.trim();
  return name || DEFAULT_USER_NAME;
}
