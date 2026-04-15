import { getDealFlowContacts } from "@/app/actions/dealflow"
import { AppShell } from "@/components/AppShell"
import { DealFlowClient } from "@/components/dealflow/DealFlowClient"
import { SystemStatusBar } from "@/components/SystemStatusBar"

export const dynamic = "force-dynamic"

export default async function DealFlowPage() {
  const contacts = await getDealFlowContacts()

  return (
    <AppShell>
      <div className="mx-auto max-w-[1500px] space-y-5">
        <SystemStatusBar />
        <header className="mission-card px-4 py-4 lg:px-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--color-text-secondary)]">
            DealFlow
          </p>
          <h1 className="mt-2 font-mono text-2xl tracking-tight text-[var(--color-accent-eggshell)]">
            Scout, pitch, and track sponsorship conversations
          </h1>
        </header>
        <DealFlowClient initialContacts={contacts} />
      </div>
    </AppShell>
  )
}
