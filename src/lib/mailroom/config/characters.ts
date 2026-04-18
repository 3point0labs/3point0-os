// =====================================================================
// Mailroom · team character configs
// ---------------------------------------------------------------------
// `TEAM_CHARACTERS` is the declarative, human-editable spec the user
// wrote: one row per teammate describing skin / hair / outfit / role.
//
// `TEAM_PRESETS` is the runtime mapping from that spec onto the
// pre-composed pixel-agents base sprites we ship today. Upgrade path:
// when we wire real paper-doll assets (separable body / hair / outfit
// layers), the config above doesn't change — only this mapping does.
// =====================================================================

export type Skin = "brown" | "fair" | "olive"
export type HairStyle =
  | "fade-black"
  | "brown-medium"
  | "black-medium"
  | "wavy-brown"
  | "curly-blonde"
export type Outfit =
  | "henley-cream"
  | "button-navy"
  | "sweater-cream"
  | "top-cognac"

export type TeamMemberId = "marquel" | "andrew" | "randy" | "kari"

export type CharacterConfig = {
  skin: Skin
  hair: HairStyle
  outfit: Outfit
  role: string
}

// Optional ColorMatrixFilter knobs applied on top of sprite.tint.
// All three default to identity when omitted.
export type FilterProfile = {
  hue?: number // degrees, 0 = no rotation
  saturation?: number // 1 = identity, <1 desaturate, >1 boost
  brightness?: number // 1 = identity, <1 darken, >1 lighten
}

export type CharacterPreset = {
  id: TeamMemberId
  displayName: string
  role: string
  config: CharacterConfig
  spriteIndex: 0 | 1 | 2 | 3 | 4 | 5 // which `char_N.png`
  tintHex: number // sprite.tint, 0xffffff = unfiltered
  filter?: FilterProfile
}

export const TEAM_CHARACTERS: Record<TeamMemberId, CharacterConfig> = {
  marquel: {
    skin: "brown",
    hair: "fade-black",
    outfit: "henley-cream",
    role: "CEO",
  },
  andrew: {
    skin: "fair",
    hair: "brown-medium",
    outfit: "button-navy",
    role: "CBO",
  },
  randy: {
    skin: "fair",
    hair: "black-medium",
    outfit: "sweater-cream",
    role: "CCO",
  },
  kari: {
    skin: "fair",
    hair: "curly-blonde",
    outfit: "top-cognac",
    role: "Creative",
  },
}

// Sprite assignments (revised after in-browser eyeball test with
// the user. The tiny thumbnails are easy to misread — these picks
// are now the ground truth):
//   char_0 → fair / dark hair / collared top        → randy
//   char_1 → fair / bob / feminine silhouette       (reserved)
//   char_2 → dark skin / dark hair / masculine      → marquel
//   char_3 → fair / long blonde / dress silhouette  → kari
//   char_4 → fair / brown / shirt+tie               → andrew
//   char_5 → fair / long dark / red skirt           (reserved)
export const TEAM_PRESETS: Record<TeamMemberId, CharacterPreset> = {
  marquel: {
    id: "marquel",
    displayName: "Marquel",
    role: "CEO",
    config: TEAM_CHARACTERS.marquel,
    spriteIndex: 2,
    tintHex: 0xffffff, // keep the base tones intact — char_2 already reads as brown-skin, dark-hair
    filter: { saturation: 0.95 },
  },
  andrew: {
    id: "andrew",
    displayName: "Andrew",
    role: "CBO",
    config: TEAM_CHARACTERS.andrew,
    spriteIndex: 4,
    tintHex: 0xdad7c9, // cool-stone wash toward a more formal button-down look
    filter: { saturation: 0.8 },
  },
  randy: {
    id: "randy",
    displayName: "Randy",
    role: "CCO",
    config: TEAM_CHARACTERS.randy,
    spriteIndex: 0,
    tintHex: 0xefe4d0, // cream wash on the collared top for a sweater-cream read
    filter: { saturation: 0.85 },
  },
  kari: {
    id: "kari",
    displayName: "Kari",
    role: "Creative",
    config: TEAM_CHARACTERS.kari,
    spriteIndex: 3,
    tintHex: 0xc9a37a, // cognac wash for `top-cognac`
    filter: { saturation: 1.1 },
  },
}

export const TEAM_MEMBER_IDS: TeamMemberId[] = [
  "marquel",
  "andrew",
  "randy",
  "kari",
]

// Resolve a profile.character_config override (if set) on top of the
// default preset. Only the fields the user customized win; everything
// else falls through to the preset. Used by the Stage + (next) modal.
export function resolvePreset(
  id: TeamMemberId,
  override?: Partial<CharacterPreset> | null,
): CharacterPreset {
  const base = TEAM_PRESETS[id]
  if (!override) return base
  return {
    ...base,
    ...override,
    config: { ...base.config, ...(override.config ?? {}) },
    filter:
      override.filter === undefined
        ? base.filter
        : { ...base.filter, ...override.filter },
  }
}
