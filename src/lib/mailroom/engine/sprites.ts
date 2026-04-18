import { Assets, Rectangle, Texture } from "pixi.js"

// Character sprite sheets from pixel-agents are 112×96 px, laid out
// as 7 cols × 4 rows with each frame 16×24 px.
//
//   row 0 = facing DOWN
//   row 1 = facing LEFT
//   row 2 = facing RIGHT
//   row 3 = facing UP
//
//   col 0 = idle (standing)
//   cols 1..6 = walk cycle frames

export const FRAME_W = 16
export const FRAME_H = 24
export const SHEET_COLS = 7
export const SHEET_ROWS = 4

export type Direction = "down" | "left" | "right" | "up"

const DIRECTION_ROW: Record<Direction, number> = {
  down: 0,
  left: 1,
  right: 2,
  up: 3,
}

const textureCache = new Map<string, Texture>()

export async function loadCharacterSheet(spriteIndex: number): Promise<Texture> {
  const url = `/mailroom/assets/characters/char_${spriteIndex}.png`
  const cached = textureCache.get(url)
  if (cached) return cached
  const tex = (await Assets.load(url)) as Texture
  tex.source.scaleMode = "nearest"
  textureCache.set(url, tex)
  return tex
}

export function frameFor(
  base: Texture,
  direction: Direction,
  col: number,
): Texture {
  const row = DIRECTION_ROW[direction]
  const clampedCol = Math.max(0, Math.min(SHEET_COLS - 1, col))
  const rect = new Rectangle(
    clampedCol * FRAME_W,
    row * FRAME_H,
    FRAME_W,
    FRAME_H,
  )
  return new Texture({ source: base.source, frame: rect })
}

export function walkFrames(base: Texture, direction: Direction): Texture[] {
  return [1, 2, 3, 4].map((col) => frameFor(base, direction, col))
}

export function idleFrame(base: Texture, direction: Direction): Texture {
  return frameFor(base, direction, 0)
}
