"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

/**
 * Phone navigation: a slim header with a hamburger that slides the full
 * sidebar in as a drawer. Hidden entirely on lg+ where the sidebar is static.
 */
export function MobileShell({ sidebar }: { sidebar: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Navigating closes the drawer.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock body scroll while the drawer is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      <div className="mb-3 flex shrink-0 items-center gap-2.5">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open navigation"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-ink"
        >
          <Menu className="h-4.5 w-4.5" strokeWidth={2} />
        </button>
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-ink text-[13px] font-extrabold text-background">
          P
        </span>
        <span className="text-[15px] font-extrabold tracking-tight">P.U.M.A</span>
      </div>

      {open && (
        <div className="fixed inset-0 z-[60]">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-ink/30 backdrop-blur-[1px]"
          />
          <div className="absolute inset-y-0 left-0 flex w-[290px] max-w-[85vw] animate-puma-view [&_aside]:w-full">
            {sidebar}
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close navigation"
              className="absolute right-2 top-3 flex h-8 w-8 items-center justify-center rounded-lg text-faint hover:bg-hover hover:text-ink"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
