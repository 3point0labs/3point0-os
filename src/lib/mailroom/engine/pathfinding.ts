import type { TilePos } from "../config/types"

// BFS on a rectangular grid. All tiles are walkable in the MVP
// (no interior walls; rooms are floor zones). The function keeps a
// walls predicate anyway so we can add obstacles later without
// changing callers.
export function findPath(
  cols: number,
  rows: number,
  start: TilePos,
  goal: TilePos,
  isBlocked: (pos: TilePos) => boolean = () => false,
): TilePos[] {
  if (start.x === goal.x && start.y === goal.y) return [start]
  if (isBlocked(goal)) return []

  const key = (p: TilePos) => `${p.x},${p.y}`
  const queue: TilePos[] = [start]
  const cameFrom = new Map<string, string>()
  const visited = new Set<string>([key(start)])

  while (queue.length > 0) {
    const current = queue.shift() as TilePos
    if (current.x === goal.x && current.y === goal.y) {
      const path: TilePos[] = []
      let cursor: string | undefined = key(current)
      while (cursor) {
        const [cx, cy] = cursor.split(",").map(Number)
        path.push({ x: cx, y: cy })
        cursor = cameFrom.get(cursor)
      }
      return path.reverse()
    }
    const neighbors: TilePos[] = [
      { x: current.x + 1, y: current.y },
      { x: current.x - 1, y: current.y },
      { x: current.x, y: current.y + 1 },
      { x: current.x, y: current.y - 1 },
    ]
    for (const n of neighbors) {
      if (n.x < 0 || n.y < 0 || n.x >= cols || n.y >= rows) continue
      if (isBlocked(n)) continue
      const k = key(n)
      if (visited.has(k)) continue
      visited.add(k)
      cameFrom.set(k, key(current))
      queue.push(n)
    }
  }
  return []
}
