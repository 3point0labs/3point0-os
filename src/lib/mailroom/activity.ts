import { promises as fs } from "fs"
import path from "path"
import type {
  AgentEvent,
  AgentId,
  AgentEventKind,
  AgentRuntimeState,
  AgentStatus,
} from "./config/types"

const ACTIVITY_PATH = path.join(process.cwd(), "data", "activity.json")
const MAX_EVENTS = 200

type ActivityFile = { events: AgentEvent[] }

async function readActivity(): Promise<ActivityFile> {
  try {
    const buf = await fs.readFile(ACTIVITY_PATH, "utf8")
    const parsed = JSON.parse(buf) as ActivityFile
    if (!parsed || !Array.isArray(parsed.events)) return { events: [] }
    return parsed
  } catch {
    return { events: [] }
  }
}

async function writeActivity(file: ActivityFile): Promise<void> {
  await fs.mkdir(path.dirname(ACTIVITY_PATH), { recursive: true })
  await fs.writeFile(ACTIVITY_PATH, JSON.stringify(file, null, 2), "utf8")
}

export async function logAgentEvent(
  agentId: AgentId,
  kind: AgentEventKind,
  meta?: Record<string, unknown>,
): Promise<void> {
  const file = await readActivity()
  const event: AgentEvent = {
    id: crypto.randomUUID(),
    agentId,
    kind,
    at: new Date().toISOString(),
    meta,
  }
  file.events.push(event)
  if (file.events.length > MAX_EVENTS) {
    file.events = file.events.slice(-MAX_EVENTS)
  }
  await writeActivity(file)
}

export async function readAgentEvents(limit = 50): Promise<AgentEvent[]> {
  const file = await readActivity()
  return file.events.slice(-limit).reverse()
}

// Derive a per-agent runtime state from the last event we saw. An
// agent is "working" when its last event was a :start, "waiting"
// when it was a :done within the last 2 minutes, "error" on :error,
// and otherwise "idle".
export async function readAgentStates(): Promise<AgentRuntimeState[]> {
  const file = await readActivity()
  const latest = new Map<AgentId, AgentEvent>()
  for (const e of file.events) {
    const prev = latest.get(e.agentId)
    if (!prev || new Date(e.at).getTime() > new Date(prev.at).getTime()) {
      latest.set(e.agentId, e)
    }
  }
  const out: AgentRuntimeState[] = []
  const now = Date.now()
  for (const [agentId, event] of latest.entries()) {
    const age = now - new Date(event.at).getTime()
    const status = deriveStatus(event.kind, age)
    out.push({
      id: agentId,
      status,
      lastEvent: event,
      message: messageFor(event.kind, event.meta),
    })
  }
  return out
}

function deriveStatus(kind: AgentEventKind, ageMs: number): AgentStatus {
  if (kind.endsWith(":start")) return "working"
  if (kind.endsWith(":error")) return "error"
  if (kind.endsWith(":done")) {
    if (ageMs < 2 * 60 * 1000) return "waiting"
    return "idle"
  }
  return "idle"
}

function messageFor(
  kind: AgentEventKind,
  meta: Record<string, unknown> | undefined,
): string | undefined {
  const company =
    meta && typeof meta.company === "string" ? meta.company : undefined
  switch (kind) {
    case "draft-email:start":
      return company ? `Drafting ${company}…` : "Drafting outreach…"
    case "draft-email:done":
      return company ? `${company} draft ready` : "Draft ready"
    case "draft-email:error":
      return "Draft failed"
    case "followup-scan:start":
      return "Scanning follow-ups…"
    case "followup-scan:done":
      return "Follow-ups flagged"
    case "study-session:start":
      return "Study session…"
    case "study-session:done":
      return "Study card ready"
    default:
      return undefined
  }
}
