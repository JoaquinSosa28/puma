"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  ListTodo,
  StickyNote,
  CircleCheck,
  Target,
  FolderKanban,
  Calendar,
  Hourglass,
  Sparkles,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./ThemeToggle";
import { TagRail } from "./TagRail";
import { LifeAreaToggle, useLifeView, hrefWithAppParams } from "./LifeAreaToggle";
import type { Tag, Task, Note } from "@/lib/schemas";

const nav = [
  { href: "/", label: "Home", icon: Home, color: "text-primary", countKey: null },
  { href: "/tasks", label: "Tasks", icon: ListTodo, color: "text-tasks", countKey: "openTasks" as const },
  { href: "/notes", label: "Notes", icon: StickyNote, color: "text-notes", countKey: "notes" as const },
  { href: "/habits", label: "Habits", icon: CircleCheck, color: "text-habits", countKey: "habits" as const },
  { href: "/goals", label: "Goals", icon: Target, color: "text-goals", countKey: "goals" as const },
  { href: "/projects", label: "Projects", icon: FolderKanban, color: "text-projects", countKey: "projects" as const },
  { href: "/calendar", label: "Calendar", icon: Calendar, color: "text-faint", countKey: null },
  { href: "/life", label: "Life calendar", icon: Hourglass, color: "text-primary", countKey: null },
  { href: "/assistant", label: "Assistant", icon: Sparkles, color: "text-primary", countKey: null },
];

type Counts = {
  openTasks: number;
  notes: number;
  habits: number;
  goals: number;
  projects: number;
};

type Props = {
  counts: Counts;
  tags: Tag[];
  tasks: Task[];
  notes: Note[];
  userName: string;
};

export function Sidebar({ counts, tags, tasks, notes, userName }: Props) {
  const pathname = usePathname();
  const [life] = useLifeView();

  return (
    <aside className="flex w-[236px] shrink-0 flex-col border-r border-border bg-surface2 px-3 py-4">
      <div className="mb-3 flex items-center gap-2 px-2 py-1.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-ink text-[13px] font-extrabold text-background">
          P
        </div>
        <div className="text-[15px] font-bold tracking-tight">P.U.M.A</div>
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </div>

      <LifeAreaToggle />

      <div className="px-2 pb-2 font-mono text-[10px] tracking-widest text-faint2">
        SPACES
      </div>
      <nav className="flex flex-col gap-px">
        {nav.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          const count = item.countKey ? counts[item.countKey] : null;
          return (
            <Link
              key={item.href}
              href={hrefWithAppParams(item.href, life)}
              className={cn(
                "flex items-center gap-[11px] rounded-lg px-2.5 py-2 text-[13.5px] text-muted transition-colors hover:bg-hover",
                active && "bg-surface font-semibold text-ink shadow-sm"
              )}
            >
              <Icon className={cn("h-[17px] w-[17px]", item.color)} strokeWidth={2} />
              {item.label}
              {count !== null && (
                <span
                  className={cn(
                    "ml-auto font-mono text-[11px] font-semibold",
                    item.countKey === "openTasks" ? "text-tasks" : "text-faint2"
                  )}
                >
                  {count}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <TagRail tags={tags} tasks={tasks} notes={notes} />

      <div className="mt-auto flex items-center gap-2.5 border-t border-border px-2.5 py-3">
        <div
          className="h-7 w-7 shrink-0 rounded-full"
          style={{
            background:
              "linear-gradient(135deg, oklch(0.7 0.12 70), oklch(0.64 0.18 25))",
          }}
        />
        <span className="min-w-0 flex-1 truncate text-[13px] text-muted">
          {userName}
        </span>
        <Link
          href={hrefWithAppParams("/settings", life)}
          title="Settings"
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] text-faint transition-colors hover:bg-hover hover:text-ink",
            pathname.startsWith("/settings") && "bg-surface text-ink shadow-sm"
          )}
        >
          <Settings className="h-4 w-4" strokeWidth={2} />
        </Link>
      </div>
    </aside>
  );
}
