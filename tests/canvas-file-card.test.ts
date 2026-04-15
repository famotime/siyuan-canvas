/* @vitest-environment jsdom */

import {
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { mount } from '@vue/test-utils'

import CanvasFileCard from '@/components/canvas/CanvasFileCard.vue'

function createFileNode(overrides: Record<string, unknown> = {}) {
  return {
    id: 'file-1',
    file: '/data/spec.sy',
    height: 180,
    type: 'file',
    width: 320,
    x: 0,
    y: 0,
    ...overrides,
  }
}

describe('CanvasFileCard', () => {
  it('renders a document preview card with tooltip and emits preview image fallback events', async () => {
    const node = createFileNode()
    const wrapper = mount(CanvasFileCard, {
      props: {
        documentPreviewHtml: '<p><img src="/data/assets/road.png" alt="road"></p>',
        imageSrc: undefined,
        node,
        preview: {
          badge: 'Document',
          detail: '/Projects/Canvas/Spec',
          headline: 'Spec',
          helper: 'Opens in SiYuan',
          kind: 'document',
        },
        showDetail: false,
        showHeadline: true,
        tooltip: '/Projects/Canvas/Spec',
      },
    })

    expect(wrapper.attributes('title')).toBe('/Projects/Canvas/Spec')
    expect(wrapper.text()).toContain('Spec')
    expect(wrapper.find('.file-card__document-preview').html()).toContain('/data/assets/road.png')

    await wrapper.find('.file-card__document-preview img').trigger('error')

    expect(wrapper.emitted('preview-image-error')).toEqual([[node, expect.any(Object)]])
  })

  it('renders a canvas thumbnail preview and emits image fallback events for image cards', async () => {
    const node = createFileNode({
      file: 'assets/road.png',
      id: 'file-image-1',
    })
    const wrapper = mount(CanvasFileCard, {
      props: {
        canvasThumbnailViewBox: '0 0 100 64',
        documentPreviewHtml: '',
        imageSrc: '/data/assets/road.png',
        node,
        preview: {
          badge: 'Canvas',
          detail: '/data/storage/siyuan-canvas/road.canvas',
          headline: 'road.canvas',
          helper: 'Nested canvas',
          kind: 'canvas',
          thumbnail: {
            edges: [{
              fromX: 10,
              fromY: 10,
              toX: 90,
              toY: 54,
            }],
            nodes: [{
              height: 32,
              width: 48,
              x: 0,
              y: 0,
            }],
          },
        },
        showDetail: true,
        showHeadline: true,
        tooltip: '/data/storage/siyuan-canvas/road.canvas',
      },
    })

    expect(wrapper.find('.file-card__canvas-preview').exists()).toBe(true)
    expect(wrapper.find('.file-card__thumbnail').attributes('viewBox')).toBe('0 0 100 64')
    expect(wrapper.find('.file-card__image').attributes('src')).toBe('/data/assets/road.png')

    await wrapper.find('.file-card__image').trigger('error')

    expect(wrapper.emitted('image-error')).toEqual([[node]])
  })
})
