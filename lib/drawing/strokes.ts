// lib/drawing/strokes.ts
// Pure stroke model for the presenter whiteboard overlay. Kept free of any
// canvas / DOM references so it can be unit-tested and reused by the renderer.

export interface Point {
  x: number
  y: number
}

export interface Stroke {
  color: string
  width: number
  points: Point[]
}

/** Begin a new stroke anchored at the first pointer position. */
export function startStroke(color: string, width: number, p: Point): Stroke {
  return { color, width, points: [p] }
}

/**
 * Append a point to a stroke immutably. Consecutive duplicate points (same x/y)
 * are ignored so a stationary pointer doesn't bloat the path.
 */
export function extendStroke(stroke: Stroke, p: Point): Stroke {
  const last = stroke.points[stroke.points.length - 1]
  if (last && last.x === p.x && last.y === p.y) return stroke
  return { ...stroke, points: [...stroke.points, p] }
}

/** Drop the most recently completed stroke. No-op on an empty list. */
export function undo(strokes: Stroke[]): Stroke[] {
  return strokes.slice(0, -1)
}
