"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import { addMeetingAction } from "@/lib/actions/agenda";
import { lifeAreaForCreate, type LifeView } from "@/lib/life-area";
import { cn } from "@/lib/utils";

const MEETING_DURATIONS = [15, 30, 45, 60, 90] as const;

/**
 * "+ Meeting" with a small popover form — shared by the Agenda widget and the
 * Calendar page so meetings can be added from anywhere a day is visible.
 * The date is prefilled from the surrounding view but stays editable.
 */
export function AddMeetingButton({
  defaultDate,
  lifeView,
  className,
  align = "right",
}: {
  defaultDate: string;
  lifeView: LifeView;
  className?: string;
  align?: "left" | "right";
}) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState("10:00");
  const [duration, setDuration] = useState<number>(30);
  const [pending, startTransition] = useTransition();

  // Follow the surrounding view's day while the form is closed.
  useEffect(() => {
    if (!open) setDate(defaultDate);
  }, [defaultDate, open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const submit = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    startTransition(async () => {
      const res = await addMeetingAction({
        title: trimmed,
        date,
        time,
        durationMins: duration,
        lifeArea: lifeAreaForCreate(lifeView),
      });
      if (!res.ok) {
        toast.error(res.error ?? "Could not add meeting");
        return;
      }
      toast.success(`Meeting ${date === defaultDate ? "" : `on ${date} `}at ${time}`);
      setTitle("");
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={cn(
          "flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-mono text-[11px] font-semibold transition-colors",
          open
            ? "border-faint bg-hover text-ink"
            : "border-border text-muted hover:border-faint2 hover:text-ink"
        )}
      >
        <CalendarPlus className="h-3.5 w-3.5" />
        Meeting
      </button>

      {open && (
        <div
          className={cn(
            "absolute top-[calc(100%+6px)] z-30 w-64 rounded-xl border border-border bg-surface p-3 shadow-[3px_3px_0_var(--shadow)]",
            align === "right" ? "right-0" : "left-0"
          )}
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-faint">
              New meeting
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="flex h-5 w-5 items-center justify-center rounded-md text-faint hover:bg-hover hover:text-ink"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            placeholder="Meeting title"
            maxLength={200}
            disabled={pending}
            className="mb-2 w-full rounded-md border border-border bg-background px-2 py-1.5 text-[13px] text-ink outline-none placeholder:text-faint2 focus:border-faint"
          />
          <div className="mb-2 flex items-center gap-1.5">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={pending}
              className="min-w-0 flex-1 rounded-md border border-border bg-background px-1.5 py-1 font-mono text-[11px] text-ink outline-none focus:border-faint"
            />
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              disabled={pending}
              className="rounded-md border border-border bg-background px-1.5 py-1 font-mono text-[11px] text-ink outline-none focus:border-faint"
            />
            <select
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              disabled={pending}
              className="rounded-md border border-border bg-background px-1 py-1 font-mono text-[11px] text-ink outline-none focus:border-faint"
            >
              {MEETING_DURATIONS.map((d) => (
                <option key={d} value={d}>
                  {d}m
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={submit}
            disabled={pending || !title.trim()}
            className="w-full rounded-lg bg-ink px-3 py-1.5 text-[12px] font-bold text-background disabled:opacity-50"
          >
            {pending ? "Adding…" : "Add meeting"}
          </button>
          <p className="mt-2 flex items-center gap-1 font-mono text-[9px] text-faint2">
            <RefreshCw className="h-2.5 w-2.5" />
            Calendar sync (Google, iCal) coming soon
          </p>
        </div>
      )}
    </div>
  );
}
