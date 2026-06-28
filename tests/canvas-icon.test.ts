import {
  describe,
  expect,
  it,
} from 'vitest'

import {
  getCanvasIconMarkup,
  hardenStrokeOnlySvgFill,
} from '@/components/canvas/canvas-icon'

describe('canvas-icon', () => {
  it('adds fill none to stroke-only iconpark shapes without changing filled shapes', () => {
    const hardened = hardenStrokeOnlySvgFill(getCanvasIconMarkup('zoom-in'))

    expect(hardened).toContain('fill="none"')
    expect(hardened).toContain('style="fill:none"')
  })

  it('adds an important fill none guard to the root svg', () => {
    const hardened = hardenStrokeOnlySvgFill(getCanvasIconMarkup('zoom-in'))

    expect(hardened).toMatch(/<svg[^>]*style="[^"]*fill:none!important/)
  })

  it('preserves icons that intentionally use currentColor fills', () => {
    const hardened = hardenStrokeOnlySvgFill(getCanvasIconMarkup('center'))

    expect(hardened).toContain('<path d="M24 26C25.1046 26 26 25.1046 26 24C26 22.8954 25.1046 22 24 22C22.8954 22 22 22.8954 22 24C22 25.1046 22.8954 26 24 26Z" fill="currentColor"/>')
  })

  it('returns valid markup for text icon without falling back to help', () => {
    const textMarkup = getCanvasIconMarkup('text')
    const helpMarkup = getCanvasIconMarkup('help')

    expect(textMarkup).not.toBe(helpMarkup)
    expect(textMarkup).toContain('d="M24 4V40"')
  })
})
