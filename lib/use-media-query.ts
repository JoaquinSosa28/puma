"use client";

import { useEffect, useState } from "react";

/**
 * Client-side media query match.
 *
 * Returns false during SSR and the very first paint, so only use it to choose
 * between components that appear AFTER an interaction — otherwise the UI
 * flashes on load. Its reason for existing is that `hidden lg:block` only hides
 * a component visually: both copies still mount, run their effects, and (for
 * editors with autosave) race each other's writes.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(query);
    const update = () => setMatches(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [query]);

  return matches;
}

/** Tailwind's `lg` breakpoint — the app's desktop/phone split. */
export function useIsDesktop(): boolean {
  return useMediaQuery("(min-width: 1024px)");
}
