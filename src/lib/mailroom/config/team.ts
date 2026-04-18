import type { TeamMember } from "./types"

// Stone & Cognac tints. Applied as sprite.tint in PixiJS so each
// character gets a subtle individual wardrobe pass against the
// shared base sprite sheet.
const COGNAC = 0xc9a37a
const CREAM = 0xe8d9bd
const STONE = 0xb7a48a

export const TEAM: TeamMember[] = [
  {
    id: "marquel",
    displayName: "Marquel",
    charSpriteIndex: 1,
    tintHex: COGNAC,
  },
  {
    id: "andrew",
    displayName: "Andrew",
    charSpriteIndex: 3,
    tintHex: CREAM,
  },
  {
    id: "randy",
    displayName: "Randy",
    charSpriteIndex: 4,
    tintHex: STONE,
  },
]

export const teamById = Object.fromEntries(
  TEAM.map((m) => [m.id, m] as const)
)
