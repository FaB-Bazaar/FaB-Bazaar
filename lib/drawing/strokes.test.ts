// lib/drawing/strokes.test.ts
import { describe, it, expect } from 'vitest'
import { startStroke, extendStroke, undo, type Stroke } from './strokes'

describe('drawing strokes', () => {
  it('startStroke seeds a single-point path with the given style', () => {
    const s = startStroke('#fde047', 4, { x: 10, y: 20 })
    expect(s).toEqual({ color: '#fde047', width: 4, points: [{ x: 10, y: 20 }] })
  })

  it('extendStroke appends a point immutably', () => {
    const s0 = startStroke('#fff', 2, { x: 0, y: 0 })
    const s1 = extendStroke(s0, { x: 5, y: 5 })
    expect(s1.points).toEqual([{ x: 0, y: 0 }, { x: 5, y: 5 }])
    expect(s0.points).toHaveLength(1) // original untouched
  })

  it('extendStroke ignores a duplicate of the last point', () => {
    const s0 = startStroke('#fff', 2, { x: 3, y: 3 })
    const s1 = extendStroke(s0, { x: 3, y: 3 })
    expect(s1).toBe(s0) // same reference, no new point
  })

  it('undo removes the last stroke', () => {
    const a = startStroke('#fff', 2, { x: 0, y: 0 })
    const b = startStroke('#fff', 2, { x: 1, y: 1 })
    expect(undo([a, b])).toEqual([a])
  })

  it('undo on an empty list is a no-op', () => {
    expect(undo([] as Stroke[])).toEqual([])
  })
})
