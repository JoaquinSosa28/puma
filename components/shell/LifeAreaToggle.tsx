"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQueryState, parseAsStringLiteral } from "nuqs";
import {
  LIFE_AREA_COOKIE,
  parseLifeView,
  hrefWithLife,
  type LifeView,
} from "@/lib/life-area";
import { cn } from "@/lib/utils";

const options = ["both", "personal", "work"] as const;

const labels: Record<(typeof options)[number], string> = {
  both: "Both",
  personal: "Personal",
  work: "Work",
};

function readLifeCookie(): LifeView {
  if (typeof document === "undefined") return "both";
  const match = document.cookie.match(/(?:^|;\s*)puma-life=([^;]*)/);
  return parseLifeView(match?.[1]);
}

export function LifeAreaToggle({ className }: { className?: string }) {
  const router = useRouter();
  const syncedFromCookie = useRef(false);
  const [life, setLife] = useQueryState(
    "life",
    parseAsStringLiteral(options).withDefault("both")
  );

  // Keep URL in sync with saved preference when landing without ?life=
  useEffect(() => {
    if (syncedFromCookie.current) return;
    syncedFromCookie.current = true;
    const params = new URLSearchParams(window.location.search);
    if (params.has("life")) return;
    const stored = readLifeCookie();
    if (stored !== life) {
      void setLife(stored);
    }
  }, [life, setLife]);

  const select = (next: LifeView) => {
    if (next === life) return;
    document.cookie = `${LIFE_AREA_COOKIE}=${next}; path=/; max-age=31536000; SameSite=Lax`;
    void setLife(next).then(() => router.refresh());
  };

  return (
    <div
      className={cn(
        "mb-3 grid grid-cols-3 gap-1 rounded-lg border border-border bg-surface p-1",
        className
      )}
    >
      {options.map((key) => {
        const active = life === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => select(key)}
            className={cn(
              "rounded-md px-1.5 py-2 text-[11px] font-semibold transition-colors",
              active
                ? key === "work"
                  ? "bg-[oklch(0.58_0.14_245/0.14)] text-[oklch(0.44_0.14_245)]"
                  : key === "personal"
                    ? "bg-[oklch(0.58_0.17_300/0.14)] text-[oklch(0.46_0.17_300)]"
                    : "bg-hover text-ink"
                : "text-muted hover:bg-hover"
            )}
          >
            {labels[key]}
          </button>
        );
      })}
    </div>
  );
}

export function useLifeView() {
  return useQueryState(
    "life",
    parseAsStringLiteral(options).withDefault("both")
  );
}

/** @deprecated use useLifeView */
export const useLifeArea = useLifeView;

export { hrefWithLife as hrefWithAppParams };
