"use client";

import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { OmniBox } from "@/components/shell/OmniBox";
import type { OmniType } from "@/lib/types";
import type { Note, Project, Tag, Task } from "@/lib/schemas";

type Props = {
  tags: Tag[];
  tasks: Task[];
  notes: Note[];
  projects: Project[];
  defaultType?: OmniType;
};

/**
 * Phone capture: a compact floating pill that opens the full OmniBox in a
 * full-screen takeover — the user trades seeing the page behind for large,
 * legible capture controls. The dock's contextual FAB opens it too via the
 * "puma:capture" event with a section-appropriate type.
 */
export function MobileCapture(props: Props) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<OmniType>(props.defaultType ?? "task");

  useEffect(() => {
    const onCapture = (e: Event) => {
      const t = (e as CustomEvent).detail?.type as OmniType | undefined;
      if (t) setType(t);
      setOpen(true);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("puma:capture", onCapture);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("puma:capture", onCapture);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

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
      <button
        type="button"
        onClick={() => {
          setType(props.defaultType ?? "task");
          setOpen(true);
        }}
        className="mb-3 flex w-full items-center gap-2.5 rounded-full border-2 border-ink bg-surface px-4 py-2.5 text-left"
      >
        <Search className="h-4 w-4 shrink-0 text-faint" strokeWidth={2.2} />
        <span className="text-[14px] font-medium text-faint">
          Capture, plan or ask…
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[70] overflow-y-auto bg-background"
          style={{
            paddingTop: "calc(0.75rem + env(safe-area-inset-top))",
            paddingBottom: "env(safe-area-inset-bottom)",
          }}
        >
          <div className="px-3 pb-8">
            <div className="mb-3 flex items-center justify-between">
              <span className="font-mono text-[11px] font-semibold uppercase tracking-widest text-faint">
                Capture
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close capture"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {/* Remount per chosen type so the dock's contextual FAB lands on
                the right SAVE AS chip. */}
            <OmniBox key={`${type}-${open}`} {...props} defaultType={type} />
          </div>
        </div>
      )}
    </div>
  );
}
