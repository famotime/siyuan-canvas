/* @vitest-environment jsdom */

import {
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick, reactive } from 'vue'

import CanvasCreateEdgeDialog from '@/components/canvas/CanvasCreateEdgeDialog.vue'

function createTextNode(overrides: Record<string, unknown> = {}) {
  return {
    height: 180,
    id: 'text-1',
    text: 'Example node',
    type: 'text',
    width: 320,
    x: 0,
    y: 0,
    ...overrides,
  }
}

function createEditorMock() {
  const sourceNode = createTextNode({
    id: 'source-1',
    text: '#### Source node',
  })
  const targetNode = createTextNode({
    id: 'target-1',
    text: 'Target node',
  })

  return reactive({
    closeCreateEdgeDialog: vi.fn(),
    edgeSources: [sourceNode],
    edgeTargets: [targetNode],
    getNodeTitle: vi.fn((node: any) => node.text || node.id),
    newEdgeFromSide: 'right',
    newEdgeLabel: '',
    newEdgeSourceId: 'source-1',
    newEdgeSourceQuery: '',
    newEdgeTargetId: 'target-1',
    newEdgeTargetQuery: '',
    newEdgeToSide: 'left',
    setNewEdgeSourceId: vi.fn(),
    setNewEdgeTargetId: vi.fn(),
    sides: ['top', 'right', 'bottom', 'left'],
    submitCreateEdgeDialog: vi.fn(),
  })
}

function t(key: string) {
  return key
}

describe('CanvasCreateEdgeDialog', () => {
  it('opens the embedded source picker and selects a source node option', async () => {
    const editor = createEditorMock()
    const wrapper = mount(CanvasCreateEdgeDialog, {
      props: {
        editor,
        getSideLabel: (side: string) => side,
        t,
      },
    })

    expect(wrapper.find('[data-testid="create-edge-source-query"]').exists()).toBe(false)

    await wrapper.find('[data-testid="create-edge-source-trigger"]').trigger('click')
    await nextTick()

    expect(wrapper.find('[data-testid="create-edge-source-query"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="create-edge-source-option"]')).toHaveLength(1)

    await wrapper.find('[data-testid="create-edge-source-option"]').trigger('click')

    expect(editor.setNewEdgeSourceId).toHaveBeenCalledWith('source-1')
    expect(wrapper.find('[data-testid="create-edge-source-query"]').exists()).toBe(false)
  })

  it('submits and closes the dialog through the footer actions', async () => {
    const editor = createEditorMock()
    const wrapper = mount(CanvasCreateEdgeDialog, {
      props: {
        editor,
        getSideLabel: (side: string) => side,
        t,
      },
    })

    const buttons = wrapper.findAll('button')
    await buttons[buttons.length - 2].trigger('click')
    await buttons[buttons.length - 1].trigger('click')

    expect(editor.closeCreateEdgeDialog).toHaveBeenCalledTimes(1)
    expect(editor.submitCreateEdgeDialog).toHaveBeenCalledTimes(1)
  })
})
