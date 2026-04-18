import type { TeamMember } from "./types"
import {
  TEAM_MEMBER_IDS,
  TEAM_PRESETS,
  type TeamMemberId,
} from "./characters"

// `TEAM` is a flat array view over `TEAM_PRESETS` so existing call sites
// (MailroomStage, PresenceAvatars, etc.) keep working unchanged while
// characters.ts stays the single source of truth.
export const TEAM: TeamMember[] = TEAM_MEMBER_IDS.map((id) => {
  const preset = TEAM_PRESETS[id]
  return {
    id: preset.id,
    displayName: preset.displayName,
    role: preset.role,
    charSpriteIndex: preset.spriteIndex,
    tintHex: preset.tintHex,
    filter: preset.filter,
  }
})

export const teamById: Record<TeamMemberId, TeamMember> = Object.fromEntries(
  TEAM.map((m) => [m.id, m] as const),
) as Record<TeamMemberId, TeamMember>
