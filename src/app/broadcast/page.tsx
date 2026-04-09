import { AppShell } from "@/components/AppShell";
import { IntelligenceClient } from "@/components/IntelligenceClient";
import { SystemStatusBar } from "@/components/SystemStatusBar";
import { filterRowsByPodcastAccess } from "@/lib/access";
import { getServerProfile } from "@/lib/auth-server";
import { readProductionCalendar } from "@/lib/production-calendar";

export const dynamic = "force-dynamic";

export default async function BroadcastPage() {
  const profile = await getServerProfile();
  const productionRaw = await readProductionCalendar();
  const production = filterRowsByPodcastAccess(productionRaw, profile);

  return (
    <AppShell>
      <div className="w-full min-w-0 space-y-5 overflow-x-hidden">
        <SystemStatusBar />
        <IntelligenceClient productionInitial={production} />
      </div>
    </AppShell>
  );
}
