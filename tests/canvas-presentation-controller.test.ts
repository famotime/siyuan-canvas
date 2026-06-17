/* @vitest-environment jsdom */

import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import CanvasPresentationController from '@/components/canvas/CanvasPresentationController.vue'

function createEditor(overrides: Record<string, unknown> = {}) {
  return {
    presentation: {
      availableNextNodes: [],
      clearRecordedPath: vi.fn(),
      hasRecordedPath: false,
      isActive: true,
      isPlaying: false,
      isRecording: false,
      next: vi.fn(),
      pathHistory: [],
      prev: vi.fn(),
      stop: vi.fn(),
      togglePlay: vi.fn(),
      toggleRecording: vi.fn(),
      ...overrides,
    },
  }
}

describe('CanvasPresentationController', () => {
  it('toggles recording from the record button and indicates saved paths', async () => {
    const editor = createEditor({ hasRecordedPath: true })
    const wrapper = mount(CanvasPresentationController, {
      props: { editor },
    })

    const recordButton = wrapper.find('[data-testid="presentation-record"]')
    expect(recordButton.exists()).toBe(true)
    expect(recordButton.classes()).toContain('b3-menu__item--has-recorded-path')

    await recordButton.trigger('pointerdown')
    await recordButton.trigger('pointerup')

    expect(editor.presentation.toggleRecording).toHaveBeenCalledOnce()
  })

  it('clears saved recorded path on long press', async () => {
    vi.useFakeTimers()
    try {
      const editor = createEditor({ hasRecordedPath: true })
      const wrapper = mount(CanvasPresentationController, {
        props: { editor },
      })

      const recordButton = wrapper.find('[data-testid="presentation-record"]')
      await recordButton.trigger('pointerdown')
      vi.advanceTimersByTime(700)
      await recordButton.trigger('pointerup')

      expect(editor.presentation.clearRecordedPath).toHaveBeenCalledOnce()
      expect(editor.presentation.toggleRecording).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })
})
