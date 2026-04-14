import { AppShell } from "@/components/AppShell";
import { SponsorsClient } from "@/components/SponsorsClient";
import { getSponsors } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function SponsorsPage() {
  const sponsors = await getSponsors();

  return (
    <AppShell>
      <div className="mx-auto max-w-[1400px] space-y-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
            Sponsor outreach
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-500">
            Track prospects for{" "}
            <span className="text-zinc-400">Pressbox Chronicles</span> and{" "}
            <span className="text-zinc-400">One54</span>. Updates persist to{" "}
            <code className="text-zinc-400">data/sponsors.json</code>.
          </p>
        </header>
        <SponsorsClient initial={sponsors} />
      </div>
    </AppShell>
  );
}
