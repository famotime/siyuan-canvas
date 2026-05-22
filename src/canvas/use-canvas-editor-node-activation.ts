import type { CanvasNode } from '@/canvas/types'
import type { ResolvedCanvasFileTarget } from '@/canvas/file-target-resolution'
import type { CanvasI18nTranslator, CanvasPluginBridge } from '@/canvas/use-canvas-editor-shared'

import { openTab, showMessage } from 'siyuan'

interface CanvasEditorNodeActivationOptions {
  ensureCanvasPath: (input: string) => string
  getResolvedFileNode: (node: Extract<CanvasNode, { type: 'file' }>) => ResolvedCanvasFileTarget & {
    detail: string
  }
  openDocumentByBlockId: (blockId: string, documentId?: string) => Promise<void>
  plugin: CanvasPluginBridge
  t: CanvasI18nTranslator
}

export function createCanvasEditorNodeActivationActions(options: CanvasEditorNodeActivationOptions) {
  const {
    ensureCanvasPath,
    getResolvedFileNode,
    openDocumentByBlockId,
    plugin,
    t,
  } = options

  function activateNode(node: CanvasNode) {
    if (node.type === 'link') {
      window.open(node.url, '_blank', 'noopener,noreferrer')
      showMessage(t('nodeActivated', { title: node.url }), 2000, 'info')
      return
    }

    if (node.type === 'file') {
      const resolved = getResolvedFileNode(node)
      if (resolved.kind === 'canvas') {
        const path = ensureCanvasPath(node.file)
        void plugin.openCanvasTab?.({ path })
        showMessage(t('nodeActivated', { title: resolved.detail || resolved.title }), 2000, 'info')
        return
      }

      if (resolved.kind === 'document') {
        void openTab({
          app: plugin.app,
          doc: {
            id: resolved.id,
          },
          keepCursor: false,
          openNewTab: true,
        })
        showMessage(t('nodeActivated', { title: resolved.detail || resolved.title }), 2000, 'info')
        return
      }

      if (resolved.kind === 'block') {
        void openDocumentByBlockId(resolved.id, resolved.rootId)
        showMessage(t('nodeActivated', { title: resolved.detail || resolved.title }), 2000, 'info')
        return
      }

      if (resolved.kind === 'image') {
        if (resolved.blockId) {
          void openDocumentByBlockId(resolved.blockId)
          showMessage(t('nodeActivated', { title: resolved.detail || resolved.title }), 2000, 'info')
          return
        }

        void openTab({
          app: plugin.app,
          asset: {
            path: resolved.openPath,
          },
          keepCursor: false,
          openNewTab: true,
        })
        showMessage(t('nodeActivated', { title: resolved.detail || resolved.title }), 2000, 'info')
      }
    }
  }

  return {
    activateNode,
  }
}
