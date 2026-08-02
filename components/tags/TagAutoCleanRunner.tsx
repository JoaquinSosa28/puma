"use client";

import { useEffect, useRef } from "react";
import { maybeAutoCleanTagsAction } from "@/lib/actions/tags";

/**
 * Kicks the opt-in tag sweep once per app load. The action itself is the real
 * gate: it no-ops unless the setting is on, and throttles to once a day per
 * account, so mounting this is cheap and safe.
 *
 * Deliberately client-triggered rather than run during a render — sweeping is a
 * write, and data loaders must stay read-only.
 */
export function TagAutoCleanRunner({ enabled }: { enabled: boolean }) {
  const ran = useRef(false);

  useEffect(() => {
    if (!enabled || ran.current) return;
    ran.current = true;
    void maybeAutoCleanTagsAction();
  }, [enabled]);

  return null;
}
