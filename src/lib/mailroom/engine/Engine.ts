import { Application, Container, FederatedPointerEvent, Ticker } from "pixi.js"
import type { MailroomLayout, RoomId, TilePos } from "../config/types"
import { Character } from "./Character"
import { TileMap } from "./TileMap"
import { findPath } from "./pathfinding"

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
}

export class MailroomEngine {
  private app: Application | null = null
  private tileMap: TileMap | null = null
  private world = new Container()
  private characters = new Map<string, Character>()
  private playerKey: string | null = null
  private lastRoomByCharacter = new Map<string, RoomId | null>()
  private mountedNode: HTMLElement | null = null
  private tickHandler = (ticker: Ticker) => this.tick(ticker)
  private pointerHandler = (event: FederatedPointerEvent) =>
    this.handleClick(event)

  constructor(
    private layout: MailroomLayout,
    private events: EngineEvents,
    private includePrivate: boolean,
  ) {}

  async mount(container: HTMLElement) {
    const app = new Application()
    await app.init({
      background: 0xe8e0d4,
      antialias: false,
      resolution: window.devicePixelRatio ?? 1,
      autoDensity: true,
      width: this.layout.cols * this.layout.tileSize * this.layout.zoom,
      height: this.layout.rows * this.layout.tileSize * this.layout.zoom,
    })
    const canvas = app.canvas
    canvas.style.width = "100%"
    canvas.style.height = "auto"
    canvas.style.imageRendering = "pixelated"
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
    const tileSize = this.layout.tileSize
    const c = new Character({
      spriteIndex: spec.spriteIndex,
      tint: spec.tint,
      tileSize,
      nameplate: spec.nameplate,
      spawn: spec.spawn,
    })
    await c.load()
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

  setBubble(key: string, content: string | null) {
    const c = this.characters.get(key)
    if (!c) return
    c.setBubble(content)
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
    if (!this.app) return
    this.app.ticker.remove(this.tickHandler)
    this.app.stage.off("pointertap", this.pointerHandler)
    for (const c of this.characters.values()) c.destroy()
    this.characters.clear()
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
    const { tileSize, zoom, cols, rows } = this.layout
    const local = this.world.toLocal(event.global)
    const tx = Math.floor(local.x / tileSize)
    const ty = Math.floor(local.y / tileSize)
    if (tx < 0 || ty < 0 || tx >= cols || ty >= rows) return
    const target = { x: tx, y: ty }
    this.events.onTileClick?.(target)
    if (this.playerKey) {
      this.moveCharacterTo(this.playerKey, target)
    }
    void zoom
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
