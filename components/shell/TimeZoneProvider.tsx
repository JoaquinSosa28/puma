"use client";

import { createContext, useContext } from "react";
import { normalizeTimezone } from "@/lib/timezone";

const TimezoneContext = createContext<string>("UTC");

export function TimeZoneProvider({
  timezone,
  children,
}: {
  timezone: string;
  children: React.ReactNode;
}) {
  const tz = normalizeTimezone(timezone);
  return (
    <TimezoneContext.Provider value={tz}>{children}</TimezoneContext.Provider>
  );
}

export function useTimezone(): string {
  return useContext(TimezoneContext);
}
