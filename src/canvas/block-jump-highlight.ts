import type { CanvasPluginBridge } from '@/canvas/use-canvas-editor-shared'

const BLOCK_HIGHLIGHT_CLASS = 'canvas-block-current'
const BLOCK_HIGHLIGHT_STYLE_ID = 'siyuan-canvas-block-jump-highlight-style'
const BLOCK_HIGHLIGHT_DURATION = 1200
const activeStyleConsumers = new Set<symbol>()

export function createCanvasBlockJumpHighlighter(plugin: CanvasPluginBridge) {
  const consumerToken = Symbol('block-jump-highlight')
  let pendingBlockId: string | null = null
  let activeElement: HTMLElement | null = null
  let activeTimer: number | null = null

  function ensureStyleSheet() {
    activeStyleConsumers.add(consumerToken)
    if (document.getElementById(BLOCK_HIGHLIGHT_STYLE_ID)) {
      return
    }

    const style = document.createElement('style')
    style.id = BLOCK_HIGHLIGHT_STYLE_ID
    style.textContent = `
.protyle-wysiwyg .${BLOCK_HIGHLIGHT_CLASS} {
  box-shadow: inset 4px 0 0 color-mix(in srgb, var(--sfsr-highlight-color, var(--b3-theme-primary)) 84%, black 16%);
  background: color-mix(in srgb, var(--sfsr-highlight-color, var(--b3-theme-primary)) 12%, transparent);
  border-radius: 6px;
}
`
    document.head.appendChild(style)
  }

  function clearActiveElement() {
    if (activeTimer !== null) {
      window.clearTimeout(activeTimer)
      activeTimer = null
    }

    if (activeElement) {
      activeElement.classList.remove(BLOCK_HIGHLIGHT_CLASS)
      activeElement = null
    }
  }

  function scheduleClear() {
    if (activeTimer !== null) {
      window.clearTimeout(activeTimer)
    }

    activeTimer = window.setTimeout(() => {
      activeTimer = null
      if (activeElement) {
        activeElement.classList.remove(BLOCK_HIGHLIGHT_CLASS)
        activeElement = null
      }
    }, BLOCK_HIGHLIGHT_DURATION)
  }

  function applyHighlight(blockElement: HTMLElement) {
    ensureStyleSheet()
    clearActiveElement()
    activeElement = blockElement
    blockElement.classList.add(BLOCK_HIGHLIGHT_CLASS)
    scheduleClear()
  }

  function tryApplyHighlight(event: any) {
    const protyleElement: HTMLElement | undefined = event?.detail?.protyle?.element ?? event?.protyle?.element
    if (!pendingBlockId || !protyleElement) {
      return
    }

    const selector = `[data-node-id="${pendingBlockId}"][data-type]`
    const blockElement = protyleElement.querySelector<HTMLElement>(selector)
      ?? protyleElement.querySelector<HTMLElement>(`[data-node-id="${pendingBlockId}"]`)

    if (!blockElement) {
      return
    }

    applyHighlight(blockElement)
    pendingBlockId = null
  }

  const handleLoadedProtyleStatic = (event: any) => {
    tryApplyHighlight(event)
  }

  const handleLoadedProtyleDynamic = (event: any) => {
    tryApplyHighlight(event)
  }

  plugin.eventBus?.on?.('loaded-protyle-static', handleLoadedProtyleStatic)
  plugin.eventBus?.on?.('loaded-protyle-dynamic', handleLoadedProtyleDynamic)

  return {
    requestBlockHighlight(blockId: string) {
      pendingBlockId = blockId
    },
    dispose() {
      plugin.eventBus?.off?.('loaded-protyle-static', handleLoadedProtyleStatic)
      plugin.eventBus?.off?.('loaded-protyle-dynamic', handleLoadedProtyleDynamic)
      pendingBlockId = null
      clearActiveElement()
      activeStyleConsumers.delete(consumerToken)
      if (activeStyleConsumers.size === 0) {
        document.getElementById(BLOCK_HIGHLIGHT_STYLE_ID)?.remove()
      }
    },
  }
}
