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
})
