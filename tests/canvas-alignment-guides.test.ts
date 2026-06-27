import {
  describe,
  expect,
  it,
} from 'vitest'

import { resolveCanvasAlignmentGuides } from '@/canvas/alignment-guides'
import type { CanvasNode } from '@/canvas/types'

function textNode(id: string, x: number, y: number, width = 100, height = 80): CanvasNode {
  return {
    height,
    id,
    text: id,
    type: 'text',
    width,
    x,
    y,
  }
}

describe('resolveCanvasAlignmentGuides', () => {
  it('snaps a moving node left edge to another node left edge', () => {
    const result = resolveCanvasAlignmentGuides({
      deltaX: -6,
      deltaY: 0,
      movingNodeIds: ['moving'],
      nodes: [
        textNode('moving', 106, 220),
        textNode('target', 100, 20),
      ],
      threshold: 8,
    })

    expect(result.deltaX).toBe(-6)
    expect(result.deltaY).toBe(0)
    expect(result.guides).toEqual([
      { axis: 'x', kind: 'left', position: 100 },
    ])
  })

  it('snaps a moving node horizontal center to another node horizontal center', () => {
    const result = resolveCanvasAlignmentGuides({
      deltaX: 4,
      deltaY: 0,
      movingNodeIds: ['moving'],
      nodes: [
        textNode('moving', 106, 220),
        textNode('target', 100, 20, 120),
      ],
      threshold: 8,
    })

    expect(result.deltaX).toBe(4)
    expect(result.guides).toContainEqual({ axis: 'x', kind: 'center-x', position: 160 })
  })

  it('snaps a moving node top edge to another node top edge', () => {
    const result = resolveCanvasAlignmentGuides({
      deltaX: 0,
      deltaY: -5,
      movingNodeIds: ['moving'],
      nodes: [
        textNode('moving', 260, 105),
        textNode('target', 20, 100),
      ],
      threshold: 8,
    })

    expect(result.deltaY).toBe(-5)
    expect(result.guides).toContainEqual({ axis: 'y', kind: 'top', position: 100 })
  })

  it('snaps the selected group bounds while preserving member spacing', () => {
    const result = resolveCanvasAlignmentGuides({
      deltaX: -5,
      deltaY: 0,
      movingNodeIds: ['a', 'b'],
      nodes: [
        textNode('a', 305, 100, 100, 80),
        textNode('b', 455, 120, 100, 80),
        textNode('target', 300, 360, 120, 80),
      ],
      threshold: 8,
    })

    expect(result.deltaX).toBe(-5)
    expect(result.guides).toEqual([
      { axis: 'x', kind: 'left', position: 300 },
    ])
  })

  it('ignores nodes that are part of the moving selection', () => {
    const result = resolveCanvasAlignmentGuides({
      deltaX: -5,
      deltaY: 0,
      movingNodeIds: ['a', 'b'],
      nodes: [
        textNode('a', 105, 100),
        textNode('b', 100, 260),
      ],
      threshold: 8,
    })

    expect(result.deltaX).toBe(-5)
    expect(result.guides).toEqual([])
  })

  it('does not snap a moving edge to a target center guide', () => {
    const result = resolveCanvasAlignmentGuides({
      deltaX: 4,
      deltaY: 0,
      movingNodeIds: ['moving'],
      nodes: [
        textNode('moving', 106, 220),
        textNode('target', 50, 20, 120),
      ],
      threshold: 8,
    })

    expect(result.deltaX).toBe(4)
    expect(result.guides).toEqual([])
  })

  it('snaps a moving center only to a target center guide', () => {
    const result = resolveCanvasAlignmentGuides({
      deltaX: 4,
      deltaY: 0,
      movingNodeIds: ['moving'],
      nodes: [
        textNode('moving', 106, 220),
        textNode('target', 100, 20, 120),
      ],
      threshold: 8,
    })

    expect(result.deltaX).toBe(4)
    expect(result.guides).toEqual([
      { axis: 'x', kind: 'center-x', position: 160 },
    ])
  })

  it('prioritizes nodes that are spatially closer to the moving node when multiple options are within threshold', () => {
    const result = resolveCanvasAlignmentGuides({
      deltaX: -5,
      deltaY: 0,
      movingNodeIds: ['moving'],
      nodes: [
        textNode('moving', 205, 100),
        textNode('target_far', 201, 1000),  // 空间距离远，但偏差只有 1 (201 - 200)
        textNode('target_near', 196, 120), // 空间距离近，但偏差有 4 (196 - 200)
      ],
      threshold: 8,
    })

    // 空间距离优先选择 target_near，即使偏差更大 (4px 对齐到 196px)
    expect(result.deltaX).toBe(-9) // -5 + (196 - 200) = -9
    expect(result.guides).toEqual([
      { axis: 'x', kind: 'left', position: 196 },
    ])
  })

})
