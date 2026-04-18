import type { AgentDescriptor, AgentId } from "./types"

// Distinct tint per agent so NPCs read as separate from team members.
const COGNAC_DEEP = 0x8b4513
const COGNAC_WARM = 0xa0552a

export const AGENTS: AgentDescriptor[] = [
  {
    id: "sponsor-outreach",
    displayName: "Outreach Agent",
    homeRoom: "mail",
    charSpriteIndex: 2,
    tintHex: COGNAC_DEEP,
  },
  {
    id: "pressbox-outreach",
    displayName: "Pressbox Agent",
    homeRoom: "mail",
    charSpriteIndex: 5,
    tintHex: COGNAC_WARM,
  },
  {
    id: "followup",
    displayName: "Follow-up Agent",
    homeRoom: "mail",
    charSpriteIndex: 0,
    tintHex: COGNAC_DEEP,
  },
  {
    id: "study",
    displayName: "Study Agent",
    homeRoom: "private",
    charSpriteIndex: 2,
    tintHex: COGNAC_WARM,
    restrictedTo: ["admin"],
  },
]

export const agentById: Record<AgentId, AgentDescriptor> = Object.fromEntries(
  AGENTS.map((a) => [a.id, a] as const)
) as Record<AgentId, AgentDescriptor>
