import { TagMenuProvider } from "@/components/tags/TagMenuProvider";
import { SidebarWithTag } from "@/components/shell/SidebarWithTag";
import { OmniBox } from "@/components/shell/OmniBox";
import { TimeZoneProvider } from "@/components/shell/TimeZoneProvider";
import { TimezoneSync } from "@/components/shell/TimezoneSync";
import { AssistantProvider } from "@/components/assistant/AssistantProvider";
import { TaskTimerProvider } from "@/components/tasks/TaskTimerProvider";
import { MobileShell } from "@/components/shell/MobileShell";
import { loadShellData } from "@/lib/data";
import { displayName } from "@/lib/user-display";
import { resolveLifeView } from "@/lib/life-view-server";
import { isAuthEnabled } from "@/lib/auth/session";
import { requireAccess } from "@/lib/billing/access";
import { DemoBanner } from "@/components/shell/DemoBanner";
import { Suspense } from "react";
import type { Note, Task } from "@/lib/schemas";

export const dynamic = "force-dynamic";

function ShellFallback() {
  return (
    <div className="flex h-dvh overflow-hidden bg-background text-ink">
      <aside className="hidden w-[236px] shrink-0 border-r border-border bg-surface2 lg:block" />
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden px-3 pt-3 lg:px-6 lg:pt-5">
        <div className="mb-[18px] h-[88px] shrink-0 rounded-xl border border-border bg-surface2" />
        <div className="flex-1 rounded-xl border border-border bg-surface2" />
      </main>
    </div>
  );
}

// The shell (sidebar counts, tag menus, omnibox suggestions, the timer) only
// needs light fields — blank out bodies/descriptions/subtasks so every page
// load doesn't serialize kilobytes of note prose it never renders.
function slimTasks(tasks: Task[]): Task[] {
  return tasks.map((t) => ({ ...t, description: "", subtasks: [] }));
}
function slimNotes(notes: Note[]): Note[] {
  return notes.map((n) => ({ ...n, body: "" }));
}

async function AppShell({ children }: { children: React.ReactNode }) {
  // Paywall gate (no-op unless BILLING_ENABLED=1): unpaid accounts → /billing.
  await requireAccess();
  const lifeView = await resolveLifeView();
  const data = await loadShellData({ lifeView });
  const s = data.settings;
  const lifeAuto = {
    enabled: s?.lifeAutoSwitch ?? false,
    workStart: s?.workStart ?? "09:00",
    workEnd: s?.workEnd ?? "18:00",
    workDays: s?.workDays ?? [1, 2, 3, 4, 5],
    overrideMins: s?.lifeAutoOverrideMins ?? 60,
  };
  const shellTasks = slimTasks(data.allTasks);
  const shellNotes = slimNotes(data.notes);

  const sidebar = (
    <SidebarWithTag
      counts={data.counts}
      tags={data.tags}
      tasks={shellTasks}
      notes={shellNotes}
      userName={displayName(data.user)}
      authEnabled={isAuthEnabled()}
      lifeAuto={lifeAuto}
    />
  );

  return (
    <TimeZoneProvider timezone={data.timezone}>
      <TimezoneSync />
      <TagMenuProvider tags={data.tags} tasks={shellTasks} notes={shellNotes}>
        <TaskTimerProvider tasks={shellTasks}>
          <div className="flex h-dvh overflow-hidden bg-background text-ink">
            <div className="hidden lg:contents">{sidebar}</div>
            <AssistantProvider>
              <main className="flex min-w-0 flex-1 flex-col overflow-hidden px-3 pt-3 lg:px-6 lg:pt-5">
                <MobileShell sidebar={sidebar} />
                {data.user?.isDemo && (
                  <DemoBanner expiresAt={data.user.demoExpiresAt ?? null} />
                )}
                <OmniBox
                  tags={data.tags}
                  tasks={shellTasks}
                  notes={shellNotes}
                  projects={data.projects}
                  defaultType={data.settings?.defaultCaptureType ?? "task"}
                />
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                  {children}
                </div>
              </main>
            </AssistantProvider>
          </div>
        </TaskTimerProvider>
      </TagMenuProvider>
    </TimeZoneProvider>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<ShellFallback />}>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
