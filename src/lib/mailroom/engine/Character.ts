import {
  ColorMatrixFilter,
  Container,
  Graphics,
  Sprite,
  Text,
  Ticker,
} from "pixi.js"
// Speech / thought bubbles render as React DOM via BubbleOverlay, not
// in-canvas. Character no longer owns a bubble surface.
import type { TilePos } from "../config/types"
import type { FilterProfile } from "../config/characters"
import {
  idleFrame,
  loadCharacterSheet,
  walkFrames,
  type Direction,
  FRAME_W,
  FRAME_H,
} from "./sprites"

const WALK_SPEED = 48
const WALK_FRAME_DURATION = 0.15

export type CharacterOptions = {
  spriteIndex: number
  tint: number
  tileSize: number
  nameplate?: string
  spawn: TilePos
  filter?: FilterProfile
}

// Build a ColorMatrixFilter from a declarative FilterProfile. The three
// knobs stack via `multiply: true` so their effect compounds instead of
// overwriting each other.
function buildColorFilter(profile: FilterProfile): ColorMatrixFilter {
  const f = new ColorMatrixFilter()
  f.reset()
  let hasApplied = false
  if (profile.hue !== undefined && profile.hue !== 0) {
    f.hue(profile.hue, hasApplied)
    hasApplied = true
  }
  if (profile.saturation !== undefined && profile.saturation !== 1) {
    f.saturate(profile.saturation, hasApplied)
    hasApplied = true
  }
  if (profile.brightness !== undefined && profile.brightness !== 1) {
    f.brightness(profile.brightness, hasApplied)
    hasApplied = true
  }
  return f
}

export class Character {
  readonly container = new Container()
  private sprite: Sprite | null = null
  private shadow: Graphics
  private nameplate?: Text
  private direction: Direction = "down"
  private walkFramesByDir: Record<Direction, ReturnType<typeof walkFrames>> | null = null
  private idleByDir: Record<Direction, ReturnType<typeof idleFrame>> | null = null
  private path: TilePos[] = []
  private pathIndex = 0
  private frameElapsed = 0
  private walkFrameIndex = 0
  private tileSize: number
  private tileX: number
  private tileY: number

  constructor(private opts: CharacterOptions) {
    this.tileSize = opts.tileSize
    this.tileX = opts.spawn.x
    this.tileY = opts.spawn.y

    this.shadow = new Graphics()
    this.shadow.ellipse(0, 0, 6, 2).fill({ color: 0x2a1f17, alpha: 0.25 })
    this.shadow.y = FRAME_H - 2
    this.container.addChild(this.shadow)

    if (opts.nameplate) {
      this.nameplate = new Text({
        text: opts.nameplate,
        style: {
          fontFamily: "monospace",
          fontSize: 8,
          fill: 0x2a1f17,
          letterSpacing: 1.4,
        },
      })
      this.nameplate.anchor.set(0.5, 1)
      this.nameplate.x = FRAME_W / 2
      this.nameplate.y = -2
      this.container.addChild(this.nameplate)
    }

    this.container.x = this.tileX * this.tileSize
    this.container.y = this.tileY * this.tileSize
  }

  async load() {
    const base = await loadCharacterSheet(this.opts.spriteIndex)
    this.walkFramesByDir = {
      down: walkFrames(base, "down"),
      left: walkFrames(base, "left"),
      right: walkFrames(base, "right"),
      up: walkFrames(base, "up"),
    }
    this.idleByDir = {
      down: idleFrame(base, "down"),
      left: idleFrame(base, "left"),
      right: idleFrame(base, "right"),
      up: idleFrame(base, "up"),
    }
    this.sprite = new Sprite(this.idleByDir.down)
    this.sprite.tint = this.opts.tint
    if (this.opts.filter) {
      this.sprite.filters = [buildColorFilter(this.opts.filter)]
    }
    this.container.addChildAt(this.sprite, 1)
  }

  get tile(): TilePos {
    return { x: this.tileX, y: this.tileY }
  }

  teleportTo(target: TilePos) {
    this.path = []
    this.pathIndex = 0
    this.walkFrameIndex = 0
    this.frameElapsed = 0
    this.tileX = target.x
    this.tileY = target.y
    this.container.x = target.x * this.tileSize
    this.container.y = target.y * this.tileSize
    if (this.sprite && this.idleByDir) {
      this.sprite.texture = this.idleByDir[this.direction]
    }
  }

  setPath(path: TilePos[]) {
    if (path.length <= 1) return
    this.path = path
    this.pathIndex = 0
    this.walkFrameIndex = 0
    this.frameElapsed = 0
  }

  get isMoving() {
    return this.path.length > 0 && this.pathIndex < this.path.length - 1
  }

  tick(ticker: Ticker) {
    if (!this.sprite || !this.walkFramesByDir || !this.idleByDir) return

    if (this.path.length > 1 && this.pathIndex < this.path.length - 1) {
      const next = this.path[this.pathIndex + 1]
      const targetX = next.x * this.tileSize
      const targetY = next.y * this.tileSize
      const dx = targetX - this.container.x
      const dy = targetY - this.container.y

      if (Math.abs(dx) > Math.abs(dy)) {
        this.direction = dx > 0 ? "right" : "left"
      } else if (dy !== 0) {
        this.direction = dy > 0 ? "down" : "up"
      }

      const step = WALK_SPEED * (ticker.deltaMS / 1000)
      const remaining = Math.hypot(dx, dy)
      if (remaining <= step) {
        this.container.x = targetX
        this.container.y = targetY
        this.tileX = next.x
        this.tileY = next.y
        this.pathIndex += 1
        if (this.pathIndex >= this.path.length - 1) {
          this.path = []
          this.sprite.texture = this.idleByDir[this.direction]
          return
        }
      } else {
        const ratio = step / remaining
        this.container.x += dx * ratio
        this.container.y += dy * ratio
      }

      this.frameElapsed += ticker.deltaMS / 1000
      if (this.frameElapsed >= WALK_FRAME_DURATION) {
        this.frameElapsed = 0
        this.walkFrameIndex = (this.walkFrameIndex + 1) % 4
        this.sprite.texture = this.walkFramesByDir[this.direction][this.walkFrameIndex]
      }
    } else {
      this.sprite.texture = this.idleByDir[this.direction]
    }
  }

  destroy() {
    this.container.destroy({ children: true })
  }
}
