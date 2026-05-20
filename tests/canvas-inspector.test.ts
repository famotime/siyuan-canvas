/* @vitest-environment jsdom */

import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { reactive } from 'vue'

import CanvasInspector from '@/components/canvas/CanvasInspector.vue'

function t(key: string) {
  return key
}

function createEditorMock() {
  return reactive({
    applySelectedNodeChanges: vi.fn(),
    inspectorSectionState: {
      createEdge: true,
      edge: true,
      node: true,
      selection: true,
    },
    selectedNode: {
      height: 120,
      id: 'n1',
      text: 'Alpha',
      type: 'text',
      width: 240,
      x: 100,
      y: 200,
    },
    selectedNodeCount: 2,
    updateNodeField: vi.fn(),
    updateNumericNodeField: vi.fn(),
  })
}

describe('CanvasInspector', () => {
  it('shows the node info form for multiple selected nodes and only applies changes after confirmation', async () => {
    const editor = createEditorMock()
    const wrapper = mount(CanvasInspector, {
      props: {
        editor,
        getSideLabel: (side: string) => side,
        t,
      },
    })

    expect(wrapper.find('[data-testid="inspector-node"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="inspector-selection-count"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="inspector-node-apply"]').exists()).toBe(true)

    await wrapper.find('[data-testid="inspector-node-x"]').setValue('320')
    await wrapper.find('[data-testid="inspector-node-text"]').setValue('Beta')

    expect(editor.applySelectedNodeChanges).not.toHaveBeenCalled()

    await wrapper.find('[data-testid="inspector-node-apply"]').trigger('click')

    expect(editor.applySelectedNodeChanges).toHaveBeenCalledWith(expect.objectContaining({
      height: 120,
      text: 'Beta',
      width: 240,
      x: 320,
      y: 200,
    }))

    wrapper.unmount()
  })
})
