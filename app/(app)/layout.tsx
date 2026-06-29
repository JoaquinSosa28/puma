import { TagMenuProvider } from "@/components/tags/TagMenuProvider";
import { SidebarWithTag } from "@/components/shell/SidebarWithTag";
import { OmniBox } from "@/components/shell/OmniBox";
import { TimeZoneProvider } from "@/components/shell/TimeZoneProvider";
import { TimezoneSync } from "@/components/shell/TimezoneSync";
import { AssistantProvider } from "@/components/assistant/AssistantProvider";
import { TaskTimerProvider } from "@/components/tasks/TaskTimerProvider";
import { loadShellData } from "@/lib/data";
import { displayName } from "@/lib/user-display";
import { resolveLifeView } from "@/lib/life-view-server";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

function ShellFallback() {
  return (
    <div className="flex h-screen overflow-hidden bg-background text-ink">
      <aside className="w-[236px] shrink-0 border-r border-border bg-surface2" />
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden px-6 pt-5">
        <div className="mb-[18px] h-[88px] shrink-0 rounded-xl border border-border bg-surface2" />
        <div className="flex-1 rounded-xl border border-border bg-surface2" />
      </main>
    </div>
  );
}

async function AppShell({ children }: { children: React.ReactNode }) {
  const lifeView = await resolveLifeView();
  const data = await loadShellData({ lifeView });

  return (
    <TimeZoneProvider timezone={data.timezone}>
      <TimezoneSync />
      <TagMenuProvider tags={data.tags} tasks={data.allTasks} notes={data.notes}>
        <TaskTimerProvider tasks={data.allTasks}>
          <div className="flex h-screen overflow-hidden bg-background text-ink">
            <SidebarWithTag
              counts={data.counts}
              tags={data.tags}
              tasks={data.allTasks}
              notes={data.notes}
              userName={displayName(data.user)}
            />
            <AssistantProvider>
              <main className="flex min-w-0 flex-1 flex-col overflow-hidden px-6 pt-5">
                <OmniBox
                  tags={data.tags}
                  tasks={data.allTasks}
                  notes={data.notes}
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
