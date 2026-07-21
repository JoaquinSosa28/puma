"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Draggable phone bottom sheet (no deps): drag handle, two snap points
 * (peek ~55dvh / full ~92dvh), drag-down to dismiss, backdrop tap closes,
 * body scroll locked while open. Callers render it only on small screens.
 */
export function BottomSheet({
  open,
  onClose,
  children,
  initialSnap = "peek",
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  initialSnap?: "peek" | "full";
}) {
  const [snap, setSnap] = useState<"peek" | "full">(initialSnap);
  const [dragY, setDragY] = useState(0);
  const drag = useRef<{ startY: number; active: boolean }>({ startY: 0, active: false });

  useEffect(() => {
    if (open) setSnap(initialSnap);
  }, [open, initialSnap]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Snap to full whenever an input inside the sheet gains focus (keyboard).
  const onFocusCapture = () => setSnap("full");

  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { startY: e.clientY, active: true };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current.active) return;
    setDragY(Math.max(-40, e.clientY - drag.current.startY));
  };
  const onPointerUp = () => {
    if (!drag.current.active) return;
    drag.current.active = false;
    const dy = dragY;
    setDragY(0);
    if (dy > 120) {
      // Big pull down: collapse full → peek, or dismiss from peek.
      if (snap === "full") setSnap("peek");
      else onClose();
    } else if (dy < -60) {
      setSnap("full");
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60]">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />
      <div
        onFocusCapture={onFocusCapture}
        className={cn(
          "absolute inset-x-0 bottom-0 flex flex-col overflow-hidden rounded-t-2xl border border-b-0 border-border bg-background shadow-[0_-4px_24px_rgba(0,0,0,0.18)]",
          !drag.current.active && "transition-[height] duration-200"
        )}
        style={{
          height: snap === "full" ? "92dvh" : "55dvh",
          transform: dragY ? `translateY(${dragY}px)` : undefined,
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        <div
          className="flex shrink-0 cursor-grab touch-none justify-center py-2.5 active:cursor-grabbing"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div className="h-1.5 w-10 rounded-full bg-border" />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {children}
        </div>
      </div>
    </div>
  );
}
