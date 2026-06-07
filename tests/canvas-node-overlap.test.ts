import { describe, expect, it } from 'vitest'
import { doNodesOverlap, findNonOverlappingPosition } from '@/canvas/node-overlap'

describe('doNodesOverlap', () => {
  it('returns false for non-overlapping nodes', () => {
    const a = { x: 0, y: 0, width: 100, height: 100 }
    const b = { x: 200, y: 200, width: 100, height: 100 }
    expect(doNodesOverlap(a, b)).toBe(false)
  })

  it('returns true for fully overlapping nodes', () => {
    const a = { x: 0, y: 0, width: 100, height: 100 }
    const b = { x: 0, y: 0, width: 100, height: 100 }
    expect(doNodesOverlap(a, b)).toBe(true)
  })

  it('returns true for partially overlapping nodes', () => {
    const a = { x: 0, y: 0, width: 100, height: 100 }
    const b = { x: 50, y: 50, width: 100, height: 100 }
    expect(doNodesOverlap(a, b)).toBe(true)
  })

  it('returns false for edge-touching nodes (no overlap)', () => {
    const a = { x: 0, y: 0, width: 100, height: 100 }
    const b = { x: 100, y: 0, width: 100, height: 100 }
    expect(doNodesOverlap(a, b)).toBe(false)
  })

  it('returns false for vertically separated nodes', () => {
    const a = { x: 0, y: 0, width: 100, height: 50 }
    const b = { x: 0, y: 50, width: 100, height: 50 }
    expect(doNodesOverlap(a, b)).toBe(false)
  })

  it('is symmetric', () => {
    const a = { x: 10, y: 10, width: 50, height: 50 }
    const b = { x: 30, y: 30, width: 50, height: 50 }
    expect(doNodesOverlap(a, b)).toBe(doNodesOverlap(b, a))
  })
})

describe('findNonOverlappingPosition', () => {
  it('returns initial position when no overlap exists', () => {
    const existing = [{ x: 200, y: 200, width: 100, height: 100 }]
    const result = findNonOverlappingPosition(0, 0, 100, 100, existing, 50)
    expect(result).toEqual({ x: 0, y: 0 })
  })

  it('offsets along Y when initial position overlaps', () => {
    const existing = [{ x: 0, y: 0, width: 100, height: 100 }]
    const result = findNonOverlappingPosition(0, 0, 100, 100, existing, 50)
    expect(result.y).toBeGreaterThan(0)
  })

  it('handles multiple overlapping nodes', () => {
    const existing = [
      { x: 0, y: 0, width: 100, height: 100 },
      { x: 0, y: 150, width: 100, height: 100 },
    ]
    const result = findNonOverlappingPosition(0, 0, 100, 100, existing, 50)
    expect(result.y).toBeGreaterThanOrEqual(250)
  })

  it('respects maxAttempts limit', () => {
    // Fill entire vertical space with overlapping nodes
    const existing = Array.from({ length: 200 }, (_, i) => ({
      x: 0, y: i * 10, width: 100, height: 10,
    }))
    const result = findNonOverlappingPosition(0, 0, 100, 10, existing, 10, 5)
    // Should stop after 5 attempts even if still overlapping
    expect(result.y).toBe(50) // 5 * 10
  })

  it('preserves X coordinate', () => {
    const existing = [{ x: 50, y: 0, width: 100, height: 100 }]
    const result = findNonOverlappingPosition(50, 0, 100, 100, existing, 30)
    expect(result.x).toBe(50)
  })
})
