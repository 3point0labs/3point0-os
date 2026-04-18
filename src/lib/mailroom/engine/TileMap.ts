import { Container, Graphics, Text } from "pixi.js"
import type { MailroomLayout, Room, Desk } from "../config/types"

const COLOR_FLOOR = 0xe8e0d4
const COLOR_FLOOR_ALT = 0xddd3c4
const COLOR_WALL = 0x2a1f17
const COLOR_ROOM_FILL = 0xf2ece1
const COLOR_ROOM_BORDER = 0x8b4513
const COLOR_DESK = 0x8b4513
const COLOR_LABEL = 0x2a1f17

export class TileMap {
  readonly container = new Container()

  constructor(private layout: MailroomLayout, private includePrivate: boolean) {
    this.draw()
  }

  private draw() {
    const { cols, rows, tileSize, desks, rooms } = this.layout

    const floor = new Graphics()
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const color = (x + y) % 2 === 0 ? COLOR_FLOOR : COLOR_FLOOR_ALT
        floor
          .rect(x * tileSize, y * tileSize, tileSize, tileSize)
          .fill({ color, alpha: 1 })
      }
    }
    this.container.addChild(floor)

    const grid = new Graphics()
    for (let x = 0; x <= cols; x++) {
      grid.moveTo(x * tileSize, 0).lineTo(x * tileSize, rows * tileSize)
    }
    for (let y = 0; y <= rows; y++) {
      grid.moveTo(0, y * tileSize).lineTo(cols * tileSize, y * tileSize)
    }
    grid.stroke({ color: COLOR_WALL, width: 1, alpha: 0.06 })
    this.container.addChild(grid)

    for (const room of rooms) {
      if (room.adminOnly && !this.includePrivate) continue
      this.drawRoom(room)
    }

    for (const desk of desks) {
      this.drawDesk(desk)
    }

    const border = new Graphics()
    border
      .rect(0, 0, cols * tileSize, rows * tileSize)
      .stroke({ color: COLOR_WALL, width: 2, alpha: 0.35 })
    this.container.addChild(border)
  }

  private drawRoom(room: Room) {
    const { tileSize } = this.layout
    const g = new Graphics()
      .rect(
        room.x * tileSize,
        room.y * tileSize,
        room.w * tileSize,
        room.h * tileSize,
      )
      .fill({ color: COLOR_ROOM_FILL, alpha: 0.6 })
      .stroke({ color: COLOR_ROOM_BORDER, width: 1, alpha: 0.6 })
    this.container.addChild(g)

    const label = new Text({
      text: room.label,
      style: {
        fontFamily: "monospace",
        fontSize: 9,
        fill: COLOR_LABEL,
        letterSpacing: 1.8,
        fontWeight: "600",
      },
    })
    label.anchor.set(0, 0)
    label.x = room.x * tileSize + 4
    label.y = room.y * tileSize + 3
    this.container.addChild(label)
  }

  private drawDesk(desk: Desk) {
    const { tileSize } = this.layout
    const g = new Graphics()
      .rect(
        desk.x * tileSize,
        desk.y * tileSize,
        desk.w * tileSize,
        desk.h * tileSize,
      )
      .fill({ color: COLOR_DESK, alpha: 0.85 })
      .stroke({ color: COLOR_WALL, width: 1, alpha: 0.4 })
    this.container.addChild(g)

    const label = new Text({
      text: desk.label,
      style: {
        fontFamily: "monospace",
        fontSize: 8,
        fill: 0xf2ece1,
        letterSpacing: 1.4,
        fontWeight: "600",
      },
    })
    label.anchor.set(0.5, 0.5)
    label.x = (desk.x + desk.w / 2) * tileSize
    label.y = (desk.y + desk.h / 2) * tileSize
    this.container.addChild(label)
  }

  pixelSize() {
    return {
      width: this.layout.cols * this.layout.tileSize,
      height: this.layout.rows * this.layout.tileSize,
    }
  }
}
