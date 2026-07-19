"use client";

import { useEffect } from "react";
import { TIMEZONE_COOKIE } from "@/lib/timezone";

/**
 * Writes the browser's IANA timezone into the `puma-timezone` cookie once, if it
 * isn't already set. This makes date math use the user's real timezone out of the
 * box, and — because server reads are cookie-first — lets server actions resolve
 * the timezone without a getSettings() DB round-trip. Never overrides an existing
 * cookie (e.g. one the user set explicitly in Settings).
 */
export function TimezoneSync() {
  useEffect(() => {
    if (document.cookie.includes(`${TIMEZONE_COOKIE}=`)) return;
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz) {
        document.cookie = `${TIMEZONE_COOKIE}=${tz}; path=/; max-age=31536000; SameSite=Lax`;
      }
    } catch {
      // ignore — server falls back to settings/default
    }
  }, []);
  return null;
}
