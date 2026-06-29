import { TagMenuProvider } from "@/components/tags/TagMenuProvider";
import { SidebarWithTag } from "@/components/shell/SidebarWithTag";
import { OmniBox } from "@/components/shell/OmniBox";
import { TaskTimerProvider } from "@/components/tasks/TaskTimerProvider";
import { loadAppData } from "@/lib/data";
import { displayName } from "@/lib/user-display";
import { getSettings } from "@/lib/db/settings";
import { resolveLifeView } from "@/lib/life-view-server";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const lifeView = await resolveLifeView();
  const data = await loadAppData({ lifeView });
  const settings = await getSettings();

  return (
    <TagMenuProvider
      tags={data.tags}
      tasks={data.allTasks}
      notes={data.notes}
    >
      <TaskTimerProvider tasks={data.allTasks}>
      <div className="flex h-screen overflow-hidden bg-background text-ink">
      <Suspense
        fallback={
          <aside className="w-[236px] shrink-0 border-r border-border bg-surface2" />
        }
      >
        <SidebarWithTag
        counts={data.counts}
        tags={data.tags}
        tasks={data.allTasks}
        notes={data.notes}
        userName={displayName(data.user)}
        />
      </Suspense>
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden px-6 pt-5">
        <Suspense fallback={<div className="mb-[18px] h-[88px] shrink-0" />}>
          <OmniBox
            tags={data.tags}
            tasks={data.allTasks}
            notes={data.notes}
            projects={data.projects}
            defaultType={settings?.defaultCaptureType ?? "task"}
          />
        </Suspense>
        <Suspense fallback={<div className="flex-1" />}>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {children}
          </div>
        </Suspense>
      </main>
    </div>
      </TaskTimerProvider>
    </TagMenuProvider>
  );
}
