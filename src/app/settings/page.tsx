import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { SettingsClient } from "@/components/SettingsClient";
import { SystemStatusBar } from "@/components/SystemStatusBar";
import { roleCanUseSettings } from "@/lib/access";
import { getServerProfile } from "@/lib/auth-server";
import { readSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const profile = await getServerProfile();
  if (!profile || !roleCanUseSettings(profile.role)) {
    redirect("/command");
  }

  const settings = await readSettings();

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-5">
        <SystemStatusBar />
        <header className="mission-card px-4 py-4 lg:px-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--color-text-secondary)]">Settings</p>
          <h1 className="mt-2 font-mono text-2xl tracking-tight text-[var(--color-accent-eggshell)]">System settings</h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Auto-discovery schedule and defaults.</p>
        </header>
        <SettingsClient initial={settings} />
      </div>
    </AppShell>
  );
}
