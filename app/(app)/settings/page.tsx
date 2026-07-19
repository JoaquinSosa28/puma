import { loadShellData } from "@/lib/data";
import { displayName } from "@/lib/user-display";
import { resolveLifeView } from "@/lib/life-view-server";
import { isAuthEnabled } from "@/lib/auth/session";
import { SettingsView } from "@/components/settings/SettingsView";

export default async function SettingsPage() {
  const lifeView = await resolveLifeView();
  const data = await loadShellData({ lifeView });

  return (
    <SettingsView
      settings={data.settings}
      userName={displayName(data.user)}
      userEmail={data.user?.email ?? null}
      authEnabled={isAuthEnabled()}
      tags={data.tags}
      stats={{ dayPct: 0, habitsLabel: "—", topStreak: 0 }}
    />
  );
}
