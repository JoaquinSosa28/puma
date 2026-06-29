import { loadAppData } from "@/lib/data";
import { getSettings } from "@/lib/db/settings";
import { displayName } from "@/lib/user-display";
import { resolveLifeView } from "@/lib/life-view-server";
import { SettingsView } from "@/components/settings/SettingsView";

export default async function SettingsPage() {
  const lifeView = await resolveLifeView();
  const data = await loadAppData({ lifeView });
  const settings = await getSettings();
  return (
    <SettingsView
      settings={settings}
      userName={displayName(data.user)}
      tags={data.tags}
      stats={data.stats}
    />
  );
}
