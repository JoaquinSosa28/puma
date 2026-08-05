"use client";

import { HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/** Where the curious end up. */
const ABOUT_URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

/**
 * The "?" beside the wordmark. Looks like an about/info affordance, and is —
 * for a given value of informative.
 */
export function AboutPummaButton({ className }: { className?: string }) {
  return (
    <a
      href={ABOUT_URL}
      target="_blank"
      rel="noopener noreferrer"
      title="What is PUMMA?"
      aria-label="What is PUMMA?"
      className={cn(
        "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-faint2 transition-colors hover:bg-hover hover:text-ink",
        className
      )}
    >
      <HelpCircle className="h-3.5 w-3.5" strokeWidth={2.2} />
    </a>
  );
}
