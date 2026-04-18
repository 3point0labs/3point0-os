import {
  Application,
  Container,
  FederatedPointerEvent,
  Graphics,
  TextureSource,
  Ticker,
} from "pixi.js"
import type { MailroomLayout, RoomId, TilePos } from "../config/types"
import type { FilterProfile } from "../config/characters"
import { Character } from "./Character"
import { TileMap } from "./TileMap"
import { findPath } from "./pathfinding"
import { FRAME_W } from "./sprites"

export type CharacterPosition = {
  key: string
  // Canvas pixel-space coordinates AFTER world.scale (zoom). The
  // React BubbleOverlay uses these to position DOM bubbles over the
  // canvas as percentages of the canvas size.
  x: number
  y: number
}

// Make every texture default to nearest-neighbour scaling. This is the
// v8 equivalent of the old `PIXI.settings.SCALE_MODE = NEAREST` switch
// and guarantees any texture we forget to touch individually still
// renders crisp. Safe to reassign on every engine boot.
TextureSource.defaultOptions.scaleMode = "nearest"

export type EngineEvents = {
  onTileClick?: (pos: TilePos) => void
  onEnterRoom?: (roomId: RoomId) => void
}

export type CharacterSpec = {
  key: string
  spriteIndex: number
  tint: number
  nameplate?: string
  spawn: TilePos
  isPlayer?: boolean
  filter?: FilterProfile
}

export class MailroomEngine {
  private app: Application | null = null
  private tileMap: TileMap | null = null
  private world = new Container()
  private characters = new Map<string, Character>()
  private playerKey: string | null = null
  private lastRoomByCharacter = new Map<string, RoomId | null>()
  private mountedNode: HTMLElement | null = null
  private disposed = false
  private tickHandler = (ticker: Ticker) => this.tick(ticker)
  private pointerHandler = (event: FederatedPointerEvent) =>
    this.handleClick(event)

  constructor(
    private layout: MailroomLayout,
    private events: EngineEvents,
    private includePrivate: boolean,
  ) {}

  async mount(container: HTMLElement) {
    if (this.disposed) return
    const app = new Application()
    const w = this.layout.cols * this.layout.tileSize * this.layout.zoom
    const h = this.layout.rows * this.layout.tileSize * this.layout.zoom
    await app.init({
      background: 0xe8e0d4,
      antialias: false,
      // Integer resolution only. We let `image-rendering: pixelated`
      // handle the device-pixel upscale at the browser layer so we
      // never get fractional snapping or bilinear filtering between
      // the backing store and the screen.
      resolution: 1,
      autoDensity: false,
      width: w,
      height: h,
    })

    if (this.disposed) {
      app.destroy(true, { children: true, texture: false })
      return
    }

    const canvas = app.canvas
    canvas.classList.add("pixel-canvas")
    canvas.style.width = "100%"
    canvas.style.height = "auto"
    container.appendChild(canvas)

    this.app = app
    this.mountedNode = container

    this.world.scale.set(this.layout.zoom)
    app.stage.addChild(this.world)

    this.tileMap = new TileMap(this.layout, this.includePrivate)
    this.world.addChild(this.tileMap.container)

    app.stage.eventMode = "static"
    app.stage.hitArea = app.screen
    app.stage.on("pointertap", this.pointerHandler)
    app.ticker.add(this.tickHandler)
  }

  async addCharacter(spec: CharacterSpec) {
    if (this.disposed || !this.app) return
    const tileSize = this.layout.tileSize
    const c = new Character({
      spriteIndex: spec.spriteIndex,
      tint: spec.tint,
      tileSize,
      nameplate: spec.nameplate,
      spawn: spec.spawn,
      filter: spec.filter,
    })
    await c.load()
    if (this.disposed || !this.app) {
      c.destroy()
      return
    }
    this.world.addChild(c.container)
    this.characters.set(spec.key, c)
    this.lastRoomByCharacter.set(spec.key, this.resolveRoom(spec.spawn))
    if (spec.isPlayer) this.playerKey = spec.key
  }

  moveCharacterTo(key: string, target: TilePos) {
    const c = this.characters.get(key)
    if (!c) return
    const path = findPath(
      this.layout.cols,
      this.layout.rows,
      c.tile,
      target,
    )
    if (path.length <= 1) return
    c.setPath(path)
  }

  // Bubbles now live in React state via BubbleOverlay; we keep this
  // method as a no-op so anything still calling it doesn't blow up.
  setBubble(_key: string, _content: string | null) {
    void _key
    void _content
  }

  getCharacterPositions(): CharacterPosition[] {
    const z = this.layout.zoom
    const out: CharacterPosition[] = []
    for (const [key, c] of this.characters) {
      out.push({
        key,
        // Anchor on top-center of the sprite so bubbles sit just above the head.
        x: (c.container.x + FRAME_W / 2) * z,
        y: c.container.y * z,
      })
    }
    return out
  }

  getCanvasSize() {
    return {
      w: this.layout.cols * this.layout.tileSize * this.layout.zoom,
      h: this.layout.rows * this.layout.tileSize * this.layout.zoom,
    }
  }

  resize() {
    const app = this.app
    if (!app || !this.mountedNode) return
    app.renderer.resize(
      this.layout.cols * this.layout.tileSize * this.layout.zoom,
      this.layout.rows * this.layout.tileSize * this.layout.zoom,
    )
  }

  destroy() {
    this.disposed = true
    if (!this.app) return
    this.app.ticker.remove(this.tickHandler)
    this.app.stage.off("pointertap", this.pointerHandler)
    for (const c of this.characters.values()) c.destroy()
    this.characters.clear()
    // `destroy(true, ...)` also removes the <canvas> from its parent
    // node, so we don't need to touch the host DOM manually.
    this.app.destroy(true, { children: true, texture: false })
    this.app = null
    this.mountedNode = null
  }

  private tick(ticker: Ticker) {
    const children = this.world.children
    for (const c of this.characters.values()) {
      c.tick(ticker)
      c.container.zIndex = c.container.y
    }
    this.world.sortableChildren = true
    for (const child of children) child.zIndex ??= 0

    if (this.playerKey) {
      const player = this.characters.get(this.playerKey)
      if (player && !player.isMoving) {
        const current = this.resolveRoom(player.tile)
        const last = this.lastRoomByCharacter.get(this.playerKey) ?? null
        if (current !== last) {
          this.lastRoomByCharacter.set(this.playerKey, current)
          if (current) this.events.onEnterRoom?.(current)
        }
      }
    }
  }

  private handleClick(event: FederatedPointerEvent) {
    if (!this.app) return
    const { tileSize, cols, rows } = this.layout
    const local = this.world.toLocal(event.global)
    const tx = Math.floor(local.x / tileSize)
    const ty = Math.floor(local.y / tileSize)
    if (tx < 0 || ty < 0 || tx >= cols || ty >= rows) return
    const target = { x: tx, y: ty }
    this.events.onTileClick?.(target)
    this.spawnClickMarker(target)
    if (this.playerKey) {
      this.moveCharacterTo(this.playerKey, target)
    }
  }

  // Quick cognac ring at the clicked tile. Fades + scales over ~400ms,
  // self-destructs, no leaked tickers.
  private spawnClickMarker(target: TilePos) {
    if (!this.app) return
    const { tileSize } = this.layout
    const ring = new Graphics()
      .circle(0, 0, 5)
      .stroke({ color: 0x8b4513, width: 1, alpha: 1 })
    ring.x = target.x * tileSize + tileSize / 2
    ring.y = target.y * tileSize + tileSize / 2
    this.world.addChild(ring)
    let elapsed = 0
    const tickerRef = this.app.ticker
    const cb = (ticker: Ticker) => {
      elapsed += ticker.deltaMS
      const t = Math.min(1, elapsed / 400)
      ring.alpha = 1 - t
      ring.scale.set(1 + t * 0.8)
      if (t >= 1) {
        tickerRef.remove(cb)
        ring.destroy()
      }
    }
    tickerRef.add(cb)
  }

  private resolveRoom(pos: TilePos): RoomId | null {
    for (const room of this.layout.rooms) {
      if (room.adminOnly && !this.includePrivate) continue
      if (
        pos.x >= room.x &&
        pos.x < room.x + room.w &&
        pos.y >= room.y &&
        pos.y < room.y + room.h
      ) {
        return room.id
      }
    }
    return null
  }
}
