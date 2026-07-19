import { loadShellData } from "@/lib/data";
import { displayName } from "@/lib/user-display";
import { resolveLifeView } from "@/lib/life-view-server";
import { isAuthEnabled, requireAccess } from "@/lib/auth/session";
import { billingEnabled } from "@/lib/billing/access";
import { SettingsView } from "@/components/settings/SettingsView";

export default async function SettingsPage() {
  const lifeView = await resolveLifeView();
  const data = await loadShellData({ lifeView });
  // Billing card only for hosted subscribers — owners and demo accounts have
  // nothing to manage, and self-hosted installs never enable billing at all.
  const showSubscription =
    billingEnabled() && (await requireAccess()) === "subscribed";

  return (
    <SettingsView
      settings={data.settings}
      userName={displayName(data.user)}
      userEmail={data.user?.email ?? null}
      authEnabled={isAuthEnabled()}
      showSubscription={showSubscription}
      tags={data.tags}
      stats={{ dayPct: 0, habitsLabel: "—", topStreak: 0 }}
    />
  );
}
