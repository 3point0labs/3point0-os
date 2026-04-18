import type { RoomId } from "./types"

export type PanelKey = RoomId | "default" | "desk:marquel" | "desk:andrew" | "desk:randy"

export const ROOM_PANEL_KEYS: Record<RoomId, PanelKey> = {
  pipeline: "pipeline",
  broadcast: "broadcast",
  mail: "mail",
  conference: "conference",
  private: "private",
}

export const ROOM_LABELS: Record<RoomId, string> = {
  pipeline: "Pipeline Wall",
  broadcast: "Broadcast Room",
  mail: "Mail Slot",
  conference: "Conference Room",
  private: "Private Office",
}
