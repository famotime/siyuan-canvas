/* @vitest-environment jsdom */

import { mount } from '@vue/test-utils'
import {
  describe,
  expect,
  it,
} from 'vitest'
import CanvasWorkspaceTree from '@/components/canvas/CanvasWorkspaceTree.vue'
import type { WorkspaceTreeNode } from '@/canvas/use-canvas-editor-workspace-tree'

describe('CanvasWorkspaceTree', () => {
  it('renders canvas files nested deeper than three levels', () => {
    const workspaceDocuments: WorkspaceTreeNode[] = [
      {
        type: 'folder',
        name: 'level-1',
        path: '/canvas/level-1',
        children: [
          {
            type: 'folder',
            name: 'level-2',
            path: '/canvas/level-1/level-2',
            children: [
              {
                type: 'folder',
                name: 'level-3',
                path: '/canvas/level-1/level-2/level-3',
                children: [
                  {
                    type: 'folder',
                    name: 'level-4',
                    path: '/canvas/level-1/level-2/level-3/level-4',
                    children: [
                      {
                        type: 'file',
                        name: 'deep.canvas',
                        path: '/canvas/level-1/level-2/level-3/level-4/deep.canvas',
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ]

    const wrapper = mount(CanvasWorkspaceTree, {
      props: {
        workspaceDocuments,
        expandedFolders: new Set([
          '/canvas/level-1',
          '/canvas/level-1/level-2',
          '/canvas/level-1/level-2/level-3',
          '/canvas/level-1/level-2/level-3/level-4',
        ]),
        currentFilePath: '',
        dragOverFolderPath: null,
        deleteTitle: '删除',
      },
    })

    expect(wrapper.text()).toContain('deep.canvas')
  })

  it('supports roving tabindex where active file has tabindex 0', () => {
    const workspaceDocuments: WorkspaceTreeNode[] = [
      { type: 'folder', name: 'Folder A', path: '/Folder A', children: [] },
      { type: 'file', name: 'File B.canvas', path: '/File B.canvas' },
    ]

    const wrapper = mount(CanvasWorkspaceTree, {
      props: {
        workspaceDocuments,
        expandedFolders: new Set(),
        currentFilePath: '/File B.canvas',
        dragOverFolderPath: null,
        deleteTitle: '删除',
      },
    })

    const buttons = wrapper.findAll('button')
    const folderButton = buttons.find(b => b.classes('workspace-tree__folder-header'))
    const fileButton = buttons.find(b => b.classes('workspace-tree__file-open'))

    expect(folderButton?.attributes('tabindex')).toBe('-1')
    expect(fileButton?.attributes('tabindex')).toBe('0')
  })

  it('navigates with ArrowDown and ArrowUp in visible items', async () => {
    const workspaceDocuments: WorkspaceTreeNode[] = [
      { type: 'folder', name: 'Folder A', path: '/Folder A', children: [] },
      { type: 'file', name: 'File B.canvas', path: '/File B.canvas' },
    ]

    const wrapper = mount(CanvasWorkspaceTree, {
      attachTo: document.body,
      props: {
        workspaceDocuments,
        expandedFolders: new Set(),
        currentFilePath: '',
        dragOverFolderPath: null,
        deleteTitle: '删除',
      },
    })

    const buttons = wrapper.findAll('button')
    const folderButton = buttons.find(b => b.classes('workspace-tree__folder-header'))
    const fileButton = buttons.find(b => b.classes('workspace-tree__file-open'))

    // 聚焦在第一个节点
    folderButton?.element.focus()
    expect(document.activeElement).toBe(folderButton?.element)

    // 触发 ArrowDown
    await folderButton?.trigger('keydown', { key: 'ArrowDown' })
    expect(document.activeElement).toBe(fileButton?.element)

    // 触发 ArrowUp
    await fileButton?.trigger('keydown', { key: 'ArrowUp' })
    expect(document.activeElement).toBe(folderButton?.element)

    wrapper.unmount()
  })
})
