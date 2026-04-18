import { promises as fs } from "fs"
import path from "path"
import { redirect } from "next/navigation"
import { MailroomClient } from "@/components/mailroom/MailroomClient"
import { readAgentStates } from "@/lib/mailroom/activity"
import { getServerProfile } from "@/lib/auth-server"
import type { MailroomLayout } from "@/lib/mailroom/config/types"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

async function readLayout(): Promise<MailroomLayout> {
  const layoutPath = path.join(
    process.cwd(),
    "public",
    "mailroom",
    "layouts",
    "mailroom.json",
  )
  const raw = await fs.readFile(layoutPath, "utf8")
  return JSON.parse(raw) as MailroomLayout
}

export default async function MailroomPage() {
  const profile = await getServerProfile()
  if (!profile) redirect("/login")

  const [layout, agentStates] = await Promise.all([
    readLayout(),
    readAgentStates(),
  ])

  return <MailroomClient layout={layout} initialAgentStates={agentStates} />
}
