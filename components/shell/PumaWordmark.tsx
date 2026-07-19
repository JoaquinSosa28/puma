import { cn } from "@/lib/utils";

/**
 * The "P.U.M.A" wordmark with a hover hint revealing the full name and the
 * story behind it. Pure CSS (group-hover) so it works in server components.
 */
export function PumaWordmark({ className }: { className?: string }) {
  return (
    <span className={cn("group/brand relative inline-block", className)}>
      <span className="cursor-default">P.U.M.A</span>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-full z-50 mt-2 w-[248px] rounded-[10px] border border-border bg-surface p-3 text-left opacity-0 shadow-[2px_2px_0_var(--shadow)] transition-opacity duration-150 group-hover/brand:opacity-100"
      >
        <span className="block text-[12px] font-bold leading-tight text-ink">
          Procrastination Ultimate Management App
        </span>
        <span className="mt-1.5 block text-[11px] font-normal leading-snug text-muted">
          I wanted to use PUMA as the name, and Claude couldn&rsquo;t come up
          with a better word suggestion 😄
        </span>
      </span>
    </span>
  );
}
