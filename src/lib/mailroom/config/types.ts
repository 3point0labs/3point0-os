import type { UserRole } from "@/lib/types/profile"
import type { FilterProfile, TeamMemberId } from "./characters"

export type { TeamMemberId } from "./characters"

export type TilePos = { x: number; y: number }
export type TileRect = { x: number; y: number; w: number; h: number }

export type RoomId =
  | "pipeline"
  | "broadcast"
  | "mail"
  | "conference"
  | "private"

export type Room = TileRect & {
  id: RoomId
  label: string
  adminOnly?: boolean
}

export type Desk = TileRect & {
  id: TeamMemberId
  label: string
}

export type MailroomLayout = {
  cols: number
  rows: number
  tileSize: number
  zoom: number
  desks: Desk[]
  rooms: Room[]
  spawns: Partial<Record<TeamMemberId, TilePos>>
  agentSpawns: Record<string, TilePos>
}

export type TeamMember = {
  id: TeamMemberId
  displayName: string
  role: string
  charSpriteIndex: 0 | 1 | 2 | 3 | 4 | 5
  tintHex: number
  filter?: FilterProfile
}

export type AgentId = "sponsor-outreach" | "pressbox-outreach" | "followup" | "study"

export type AgentDescriptor = {
  id: AgentId
  displayName: string
  homeRoom: RoomId
  charSpriteIndex: 0 | 1 | 2 | 3 | 4 | 5
  tintHex: number
  restrictedTo?: UserRole[]
}

export type AgentEventKind =
  | "draft-email:start"
  | "draft-email:done"
  | "draft-email:error"
  | "followup-scan:start"
  | "followup-scan:done"
  | "study-session:start"
  | "study-session:done"

export type AgentEvent = {
  id: string
  agentId: AgentId
  kind: AgentEventKind
  at: string
  meta?: Record<string, unknown>
}

export type AgentStatus = "idle" | "working" | "waiting" | "error"

export type AgentRuntimeState = {
  id: AgentId
  status: AgentStatus
  lastEvent?: AgentEvent
  message?: string
}
