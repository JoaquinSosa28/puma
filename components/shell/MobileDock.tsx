"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Calendar,
  CheckCircle2,
  FileText,
  Folder,
  Hourglass,
  House,
  ListTodo,
  MoreHorizontal,
  Plus,
  Settings,
  Sparkles,
  Target,
} from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { LifeAreaToggle, type LifeAutoConfig, useLifeView } from "@/components/shell/LifeAreaToggle";
import { hrefWithLife } from "@/lib/life-area";
import { cn } from "@/lib/utils";

type DockItem = {
  href: string;
  label: string;
  icon: typeof House;
  color: string;
  captureType?: "task" | "note" | "goal" | "habit";
};

const DOCK: DockItem[] = [
  { href: "/", label: "Home", icon: House, color: "var(--primary)", captureType: "task" },
  { href: "/tasks", label: "Tasks", icon: ListTodo, color: "oklch(0.64 0.18 25)", captureType: "task" },
  { href: "/calendar", label: "Calendar", icon: Calendar, color: "oklch(0.58 0.14 245)", captureType: "task" },
  { href: "/notes", label: "Notes", icon: FileText, color: "oklch(0.7 0.12 70)", captureType: "note" },
];

const MORE: { href: string; label: string; icon: typeof House }[] = [
  { href: "/habits", label: "Habits", icon: CheckCircle2 },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/projects", label: "Projects", icon: Folder },
  { href: "/life", label: "Life calendar", icon: Hourglass },
  { href: "/assistant", label: "Assistant", icon: Sparkles },
  { href: "/settings", label: "Settings", icon: Settings },
];

/**
 * Phone navigation: a floating pill dock. The active tab grows into a colored
 * pill with its label, and a contextual mini-FAB blooms above the dock to
 * capture into the section you're looking at. "More" opens a sheet with the
 * rest of the nav + the Personal/Work toggle (replaces the old drawer).
 */
export function MobileDock({ lifeAuto }: { lifeAuto?: LifeAutoConfig }) {
  const pathname = usePathname();
  const [life] = useLifeView();
  const [moreOpen, setMoreOpen] = useState(false);

  const activeItem =
    DOCK.find((d) => (d.href === "/" ? pathname === "/" : pathname.startsWith(d.href))) ?? null;
  const moreActive = !activeItem && MORE.some((m) => pathname.startsWith(m.href));

  const openCapture = (type?: string) => {
    window.dispatchEvent(
      new CustomEvent("puma:capture", { detail: { type: type ?? "task" } })
    );
  };

  return (
    <>
      <div
        className="fixed inset-x-0 z-40 flex justify-center lg:hidden"
        style={{ bottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
      >
        <div className="relative flex items-center gap-0.5 rounded-full border border-border bg-surface/95 px-1.5 py-1.5 shadow-[0_6px_24px_rgba(0,0,0,0.16)] backdrop-blur">
          {DOCK.map((item) => {
            const active = item === activeItem;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={hrefWithLife(item.href, life)}
                aria-label={item.label}
                className={cn(
                  "flex items-center gap-1.5 rounded-full transition-all duration-200",
                  active ? "px-3.5 py-2.5" : "p-2.5 text-muted"
                )}
                style={
                  active
                    ? {
                        color: item.color.includes("oklch")
                          ? item.color.replace(")", " / 0.95)")
                          : item.color,
                        background: item.color.includes("oklch")
                          ? item.color.replace(")", " / 0.14)")
                          : "var(--hover)",
                      }
                    : undefined
                }
              >
                <Icon
                  className={cn(
                    "shrink-0 transition-transform duration-200",
                    active ? "h-[22px] w-[22px]" : "h-[19px] w-[19px]"
                  )}
                  strokeWidth={active ? 2.4 : 2}
                />
                {active && (
                  <span className="text-[12px] font-bold">{item.label}</span>
                )}
              </Link>
            );
          })}
          <button
            type="button"
            aria-label="More"
            onClick={() => setMoreOpen(true)}
            className={cn(
              "flex items-center rounded-full p-2.5 transition-colors",
              moreActive ? "bg-hover text-ink" : "text-muted"
            )}
          >
            <MoreHorizontal className="h-[19px] w-[19px]" strokeWidth={2} />
          </button>

          {/* Contextual capture FAB blooms from the dock for the active section */}
          {activeItem?.captureType && (
            <button
              type="button"
              aria-label={`Capture ${activeItem.captureType}`}
              onClick={() => openCapture(activeItem.captureType)}
              className="absolute -right-1 -top-12 flex h-11 w-11 items-center justify-center rounded-full border-2 border-background text-background shadow-[0_4px_14px_rgba(0,0,0,0.25)] transition-transform active:scale-95"
              style={{ background: activeItem.color }}
            >
              <Plus className="h-5 w-5" strokeWidth={2.6} />
            </button>
          )}
        </div>
      </div>

      <BottomSheet open={moreOpen} onClose={() => setMoreOpen(false)}>
        <div className="px-4 pb-6">
          <LifeAreaToggle auto={lifeAuto} className="mb-4" />
          <div className="grid grid-cols-2 gap-2">
            {MORE.map((item) => {
              const Icon = item.icon;
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={hrefWithLife(item.href, life)}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    "flex items-center gap-2.5 rounded-xl border px-3.5 py-3.5 text-sm font-semibold transition-colors",
                    active
                      ? "border-faint2 bg-hover text-ink"
                      : "border-border bg-surface text-muted"
                  )}
                >
                  <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      </BottomSheet>
    </>
  );
}
