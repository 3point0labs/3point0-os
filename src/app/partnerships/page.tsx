import { AppShell } from "@/components/AppShell";
import { PartnershipsClient } from "@/components/PartnershipsClient";
import { SystemStatusBar } from "@/components/SystemStatusBar";
import { filterRowsByPodcastAccess, filterSponsorsByProfile } from "@/lib/access";
import { getServerProfile } from "@/lib/auth-server";
import { getSponsors } from "@/lib/data";
import { readSuggestions } from "@/lib/suggestions";

export const dynamic = "force-dynamic";

export default async function PartnershipsPage() {
  const profile = await getServerProfile();

  const [sponsorsRaw, suggestionsRaw] = await Promise.all([getSponsors(), readSuggestions()]);
  const sponsors = filterSponsorsByProfile(sponsorsRaw, profile);
  const suggestions = filterRowsByPodcastAccess(suggestionsRaw, profile);

  return (
    <AppShell>
      <div className="mx-auto max-w-[1500px] space-y-5">
        <SystemStatusBar />

        <header className="mission-card px-4 py-4 lg:px-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--color-text-secondary)]">Partnerships</p>
          <h1 className="mt-2 font-mono text-2xl tracking-tight text-[var(--color-accent-eggshell)]">Partnership command</h1>
          <p className="mt-1 max-w-3xl text-sm text-[var(--color-text-secondary)]">
            Sponsor pipeline and outreach for{" "}
            <span className="text-[var(--color-accent-eggshell)]">Pressbox Chronicles</span> and{" "}
            <span className="text-[var(--color-accent-eggshell)]">One54</span>. Data:{" "}
            <code className="text-[color:var(--accent)]">data/sponsors.json</code>
          </p>
        </header>

        <PartnershipsClient initial={sponsors} suggestions={suggestions} />
      </div>
    </AppShell>
  );
}
