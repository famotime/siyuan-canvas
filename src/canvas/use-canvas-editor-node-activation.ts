import type { ResolvedCanvasFileTarget } from '@/canvas/file-target-resolution'
import type { CanvasNode } from '@/canvas/types'
import type {
  CanvasI18nTranslator,
  CanvasPluginBridge,
} from '@/canvas/use-canvas-editor-shared'

import {
  openTab,
  showMessage,
} from 'siyuan'
import { openExternalFile } from '@/canvas/open-external-file'

interface CanvasEditorNodeActivationOptions {
  currentCanvasFilePath?: () => string
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
    currentCanvasFilePath,
    ensureCanvasPath,
    getResolvedFileNode,
    openDocumentByBlockId,
    plugin,
    t,
  } = options

  function activateNode(node: CanvasNode) {
    if (node.type === 'link') {
      if (node.url.startsWith('file://')) {
        void openExternalFile(node.url, {
          currentCanvasFilePath: currentCanvasFilePath?.(),
        })
      } else {
        window.open(node.url, '_blank', 'noopener,noreferrer')
      }
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
        return
      }

      if (resolved.kind === 'file') {
        // 安全拦截：若 resolved.path 或 node.file 实际上是思源块/文档 ID，绝不能调用外部 openExternalFile 打开本地文件
        const targetId = (/^\d{14}-[a-z0-9]{7}$/i.test(resolved.path.trim())
          ? resolved.path.trim()
          : /^\d{14}-[a-z0-9]{7}$/i.test(node.file.trim())
            ? node.file.trim()
            : '')
        if (targetId) {
          void openTab({
            app: plugin.app,
            doc: {
              id: targetId,
            },
            keepCursor: false,
            openNewTab: true,
          })
          showMessage(t('nodeActivated', { title: resolved.detail || resolved.title }), 2000, 'info')
          return
        }

        void openExternalFile(resolved.path, {
          currentCanvasFilePath: currentCanvasFilePath?.(),
        }).then((openResult) => {
          if (openResult.success) {
            showMessage(t('nodeActivated', { title: resolved.detail || resolved.title }), 2000, 'info')
          } else if (openResult.error) {
            showMessage(openResult.error, 4000, 'error')
          }
        })
      }
    }
  }

  return {
    activateNode,
  }
}
