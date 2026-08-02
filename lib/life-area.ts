import type { LifeArea, LifeView } from "@/lib/types";

export type { LifeArea, LifeView };

export const LIFE_AREA_COOKIE = "puma-life";
export const DEFAULT_LIFE_VIEW: LifeView = "both";

export function parseLifeView(value?: string | null): LifeView {
  if (value === "work") return "work";
  if (value === "personal") return "personal";
  return "both";
}

/** @deprecated use parseLifeView */
export const parseLifeArea = parseLifeView;

export function filterByLifeView<T extends { lifeArea: LifeArea | "both" }>(
  items: T[],
  view: LifeView
): T[] {
  if (view === "both") return items;
  // An item tagged lifeArea "both" (tasks/notes only) shows in every view.
  return items.filter((item) => item.lifeArea === view || item.lifeArea === "both");
}

/** @deprecated use filterByLifeView */
export const filterByLifeArea = filterByLifeView;

/**
 * Goals say personal/professional where everything else says personal/work.
 * It's the same divide under different words, and the category is the half a
 * goal actually shows and lets you set — its stored lifeArea is written
 * inconsistently by the various create paths and never surfaces in the UI, so
 * the category is the one to trust.
 */
export function goalLifeArea(
  category: "personal" | "professional"
): LifeArea {
  return category === "professional" ? "work" : "personal";
}

export function filterGoalsByLifeView<
  T extends { category: "personal" | "professional" },
>(goals: T[], view: LifeView): T[] {
  if (view === "both") return goals;
  return goals.filter((goal) => goalLifeArea(goal.category) === view);
}

export function lifeAreaForCreate(view: LifeView): LifeArea {
  return view === "work" ? "work" : "personal";
}

export function hrefWithLife(path: string, view: LifeView) {
  const params = new URLSearchParams();
  params.set("life", view);
  const [base, existing] = path.split("?");
  const merged = new URLSearchParams(existing);
  params.forEach((value, key) => merged.set(key, value));
  return `${base}?${merged.toString()}`;
}
