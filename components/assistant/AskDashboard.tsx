"use client";

import Link from "next/link";
import type { AskResult, Widget } from "@/lib/ai/ask-schema";
import { normalizeInAppHref } from "@/lib/ask-links";
import { cn } from "@/lib/utils";

const SPAN: Record<number, string> = {
  1: "md:col-span-1",
  2: "md:col-span-2",
  3: "md:col-span-3",
};

const ROW_LINK =
  "flex w-full items-center gap-2 rounded-md px-1 py-1.5 -mx-1 text-primary transition-colors hover:bg-hover hover:underline";

export function AskDashboard({ result }: { result: AskResult }) {
  return (
    <div>
      <p className="mb-4 text-[14px] leading-relaxed text-ink">{result.answer}</p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {result.widgets.map((w, i) => (
          <div key={i} className={cn(SPAN[w.span] ?? "md:col-span-1")}>
            <WidgetCard widget={w} />
          </div>
        ))}
      </div>
      <div className="mt-4 font-mono text-[10px] text-faint">
        analyzed {result.dataMode === "full" ? "your full data" : "your recent data"}
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col rounded-[12px] border border-border bg-surface p-3.5 shadow-sm">
      <div className="mb-2 font-mono text-[10px] uppercase tracking-wide text-faint">
        {title}
      </div>
      {children}
    </div>
  );
}

function FocusRow({
  href,
  label,
  sublabel,
  className,
  children,
}: {
  href?: string | null;
  label: string;
  sublabel?: string | null;
  className?: string;
  children?: React.ReactNode;
}) {
  const valid = normalizeInAppHref(href);
  const content = children ?? (
    <>
      <span className="min-w-0 flex-1 truncate text-[13px]">{label}</span>
      {sublabel ? (
        <span className="shrink-0 font-mono text-[10px] text-faint">{sublabel}</span>
      ) : null}
    </>
  );

  if (valid) {
    return (
      <Link href={valid} className={cn(ROW_LINK, className)}>
        {content}
      </Link>
    );
  }

  return (
    <div className={cn("flex w-full items-center gap-2 px-1 py-1.5 -mx-1 text-ink", className)}>
      {content}
    </div>
  );
}

function WidgetCard({ widget }: { widget: Widget }) {
  switch (widget.type) {
    case "stat":
      return (
        <Card title={widget.title}>
          <div className="flex flex-1 flex-col justify-center">
            <div className="text-[28px] font-extrabold leading-none text-primary">
              {widget.value}
            </div>
            {widget.label && (
              <div className="mt-1 text-[12px] text-muted">{widget.label}</div>
            )}
            {widget.hint && (
              <div className="mt-0.5 font-mono text-[10px] text-faint">
                {widget.hint}
              </div>
            )}
          </div>
        </Card>
      );

    case "bar": {
      const max = Math.max(1, ...widget.series.map((s) => s.value));
      return (
        <Card title={widget.title}>
          <div className="flex flex-col divide-y divide-border2">
            {widget.series.map((s, i) => (
              <FocusRow
                key={i}
                href={s.href}
                label={s.label}
                className="gap-2"
              >
                <div className="w-24 shrink-0 truncate text-[11.5px] text-muted">
                  {s.label}
                </div>
                <div className="h-3.5 flex-1 overflow-hidden rounded bg-surface2">
                  <div
                    className="h-full rounded bg-primary"
                    style={{ width: `${(s.value / max) * 100}%` }}
                  />
                </div>
                <div className="w-12 shrink-0 text-right font-mono text-[11px] text-ink">
                  {s.value}
                  {widget.unit ? <span className="text-faint">{widget.unit}</span> : null}
                </div>
              </FocusRow>
            ))}
          </div>
        </Card>
      );
    }

    case "list":
      return (
        <Card title={widget.title}>
          <ul className="flex flex-col divide-y divide-border2">
            {widget.items.map((item, i) => (
              <li key={i}>
                <FocusRow href={item.href} label={item.label} sublabel={item.sublabel} />
              </li>
            ))}
          </ul>
        </Card>
      );

    case "calendar":
      return (
        <Card title={widget.title}>
          <MonthCalendar month={widget.month} marks={widget.marks} />
        </Card>
      );

    case "table":
      return (
        <Card title={widget.title}>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[12px]">
              <thead>
                <tr>
                  {widget.columns.map((c, i) => (
                    <th
                      key={i}
                      className="border-b border-border px-2 py-1 text-left font-mono text-[10px] uppercase tracking-wide text-faint"
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {widget.rows.map((row, ri) => (
                  <tr key={ri}>
                    {row.map((cell, ci) => (
                      <td
                        key={ci}
                        className="border-b border-border2 px-2 py-1 text-ink"
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      );

    case "text":
    default:
      return (
        <Card title={widget.title}>
          <div className="whitespace-pre-wrap text-[13px] leading-relaxed text-muted">
            {widget.body}
          </div>
        </Card>
      );
  }
}

const DOW = ["M", "T", "W", "T", "F", "S", "S"];

function MonthCalendar({
  month,
  marks,
}: {
  month: string;
  marks: { date: string; intensity?: number | null; label?: string | null }[];
}) {
  const [y, m] = month.split("-").map(Number);
  if (!y || !m) return null;
  const first = new Date(y, m - 1, 1);
  const daysInMonth = new Date(y, m, 0).getDate();
  // Monday-first offset.
  const offset = (first.getDay() + 6) % 7;
  const byDate = new Map(marks.map((mk) => [mk.date, mk]));
  const pad = (n: number) => String(n).padStart(2, "0");

  const cells: ({ day: number; mark?: (typeof marks)[number] } | null)[] = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${y}-${pad(m)}-${pad(d)}`;
    cells.push({ day: d, mark: byDate.get(key) });
  }

  return (
    <div>
      <div className="mb-1 text-[11px] font-semibold text-muted">
        {first.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {DOW.map((d, i) => (
          <div key={`h${i}`} className="text-center font-mono text-[8px] text-faint">
            {d}
          </div>
        ))}
        {cells.map((c, i) =>
          c === null ? (
            <div key={`e${i}`} />
          ) : (
            <div
              key={c.day}
              title={c.mark?.label ?? undefined}
              className={cn(
                "flex aspect-square items-center justify-center rounded-[4px] text-[10px]",
                c.mark ? "text-white" : "bg-surface2 text-faint"
              )}
              style={
                c.mark
                  ? {
                      background: `color-mix(in oklch, var(--habits) ${Math.round(
                        Math.max(0.15, Math.min(1, c.mark.intensity ?? 1)) * 100
                      )}%, var(--surface2))`,
                    }
                  : undefined
              }
            >
              {c.day}
            </div>
          )
        )}
      </div>
    </div>
  );
}
