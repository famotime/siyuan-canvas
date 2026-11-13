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

  it('enables next button via canGoNext in recorded mode even when availableNextNodes is empty', async () => {
    const editor = createEditor({
      availableNextNodes: [],
      canGoNext: true,
      canGoPrev: true,
    })
    const wrapper = mount(CanvasPresentationController, {
      props: { editor },
    })

    const prevButton = wrapper.find('[data-testid="presentation-prev"]')
    const nextButton = wrapper.find('[data-testid="presentation-next"]')
    expect((prevButton.element as HTMLButtonElement).disabled).toBe(false)
    expect((nextButton.element as HTMLButtonElement).disabled).toBe(false)

    await nextButton.trigger('click')
    expect(editor.presentation.next).toHaveBeenCalledOnce()
  })

  it('cancels long press timer on pointercancel without clearing or toggling recording', async () => {
    vi.useFakeTimers()
    try {
      const editor = createEditor({ hasRecordedPath: true })
      const wrapper = mount(CanvasPresentationController, {
        props: { editor },
      })

      const recordButton = wrapper.find('[data-testid="presentation-record"]')
      await recordButton.trigger('pointerdown')
      await recordButton.trigger('pointercancel')
      vi.advanceTimersByTime(1000)

      expect(editor.presentation.clearRecordedPath).not.toHaveBeenCalled()
      expect(editor.presentation.toggleRecording).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })
})
