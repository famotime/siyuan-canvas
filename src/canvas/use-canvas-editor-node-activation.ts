import type { CanvasNode } from '@/canvas/types'
import type { ResolvedCanvasFileTarget } from '@/canvas/file-target-resolution'
import type { CanvasPluginBridge } from '@/canvas/use-canvas-editor-shared'

import { openTab, showMessage } from 'siyuan'

interface CanvasEditorNodeActivationOptions {
  ensureCanvasPath: (input: string) => string
  getNodeTitle: (node: CanvasNode) => string
  getResolvedFileNode: (node: Extract<CanvasNode, { type: 'file' }>) => ResolvedCanvasFileTarget & {
    detail: string
  }
  openDocumentByBlockId: (blockId: string, documentId?: string) => Promise<void>
  plugin: CanvasPluginBridge
}

export function createCanvasEditorNodeActivationActions(options: CanvasEditorNodeActivationOptions) {
  const {
    ensureCanvasPath,
    getNodeTitle,
    getResolvedFileNode,
    openDocumentByBlockId,
    plugin,
  } = options

  function activateNode(node: CanvasNode) {
    if (node.type === 'link') {
      window.open(node.url, '_blank', 'noopener,noreferrer')
      return
    }

    if (node.type === 'file') {
      const resolved = getResolvedFileNode(node)
      if (resolved.kind === 'canvas') {
        const path = ensureCanvasPath(node.file)
        void plugin.openCanvasTab?.({ path })
        return
      }

      if (resolved.kind === 'document') {
        void openTab({
          app: plugin.app,
          doc: {
            id: resolved.id,
          },
          keepCursor: true,
          openNewTab: true,
        })
        return
      }

      if (resolved.kind === 'block') {
        void openDocumentByBlockId(resolved.id, resolved.rootId)
        return
      }

      if (resolved.kind === 'image') {
        if (resolved.blockId) {
          void openDocumentByBlockId(resolved.blockId)
          return
        }

        void openTab({
          app: plugin.app,
          asset: {
            path: resolved.openPath,
          },
          keepCursor: true,
          openNewTab: true,
        })
        return
      }

      showMessage(resolved.detail || node.file, 2500, 'info')
      return
    }

    showMessage(getNodeTitle(node), 2500, 'info')
  }

  return {
    activateNode,
  }
}
