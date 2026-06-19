import {
  describe,
  expect,
  it,
} from 'vitest'

import {
  applyFilePreviewImageOverrides,
  getFilePreviewImageCandidates,
  getNextFilePreviewImageSource,
} from '@/canvas/file-preview-fallbacks'

describe('canvas file preview fallbacks', () => {
  it('builds normalized asset path candidates for image fallbacks', () => {
    expect(getFilePreviewImageCandidates('/data/assets/road.png')).toEqual([
      '/data/assets/road.png',
      '/assets/road.png',
    ])

    expect(getFilePreviewImageCandidates('assets/road.png')).toEqual([
      'assets/road.png',
      '/data/assets/road.png',
      '/assets/road.png',
    ])
  })

  it('builds display URL candidates for workspace storage image files', () => {
    expect(getFilePreviewImageCandidates('/data/storage/maps/roadmap.assets/dropped.png')).toEqual([
      '/data/storage/maps/roadmap.assets/dropped.png',
      '/storage/maps/roadmap.assets/dropped.png',
    ])
  })

  it('replaces preview html image sources with stored override mappings', () => {
    const html = '<p><img src="/data/assets/road.png" alt="road"></p>'

    expect(applyFilePreviewImageOverrides(html, {
      '/data/assets/road.png': '/assets/road.png',
    })).toBe('<p><img src="/assets/road.png" alt="road"></p>')
  })

  it('selects the next candidate after the current preview image source', () => {
    expect(getNextFilePreviewImageSource('/data/assets/road.png', '/data/assets/road.png')).toBe('/assets/road.png')
    expect(getNextFilePreviewImageSource('/data/assets/road.png', '/assets/road.png')).toBeUndefined()
  })
})
