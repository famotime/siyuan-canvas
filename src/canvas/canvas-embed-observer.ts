import type { Plugin } from "siyuan"
import { CANVAS_EMBED_BOUND_ATTR, CANVAS_EMBED_CLASS } from "@/canvas/canvas-embed-insert"
import { CANVAS_EMBED_REFRESH_EVENT, type CanvasEmbedRefreshEventDetail } from "@/canvas/canvas-embed-events"
import { openCanvasEditorTab } from "@/canvas/plugin-tabs"
import { getBlockAttrs, getFileText, sql } from "@/api"
import { parseCanvasDocument } from "@/canvas/format"
import { generateCanvasEmbedDataUrl } from "@/canvas/canvas-embed-preview"

let observer: MutationObserver | null = null
let refreshListener: ((event: Event) => void) | null = null
let delegatedClickListener: ((event: MouseEvent) => void) | null = null
const iframeClickListeners = new WeakMap<Document, (event: MouseEvent) => void>()
const iframeLoadListeners = new WeakMap<HTMLIFrameElement, () => void>()
const CANVAS_EMBED_IFRAME_OVERLAY_ATTR = "data-canvas-embed-iframe-overlay"

function debugCanvasEmbed(message: string, data?: Record<string, unknown>) {
  console.debug(`[siyuan-canvas] ${message}`, data || {})
}

function bindCanvasEmbedClick(element: HTMLElement, plugin: Plugin, pluginName: string) {
  if (element.getAttribute(CANVAS_EMBED_BOUND_ATTR) === "true") return

  const canvasPath = normalizeCanvasPath(element.dataset.canvasPath || "")
  if (!canvasPath) return

  element.setAttribute(CANVAS_EMBED_BOUND_ATTR, "true")
  element.style.cursor = "pointer"

  element.addEventListener("click", (event) => {
    event.preventDefault()
    event.stopPropagation()
    void openCanvasEditorTab(plugin, pluginName, { path: canvasPath }, "Untitled.canvas")
  })
}

function scanAndBind(root: Element, plugin: Plugin, pluginName: string) {
  const elements = root.querySelectorAll<HTMLElement>(`.${CANVAS_EMBED_CLASS}`)
  for (const el of elements) {
    bindCanvasEmbedClick(el, plugin, pluginName)
  }
}

function findCanvasEmbedBlockId(element: HTMLElement): string {
  return element.closest<HTMLElement>("[data-node-id]")?.getAttribute("data-node-id") || ""
}

function normalizeCanvasPath(path: string): string {
  if (!path) return ""
  return path.replace(/^\/\/data\//, "/data/")
}

async function getCanvasPathFromBlockAttrs(blockId: string): Promise<string> {
  if (!blockId) return ""

  try {
    const attrs = await getBlockAttrs(blockId)
    const canvasPath = normalizeCanvasPath(attrs?.["custom-canvas-path"] || "")
    if (!canvasPath) {
      debugCanvasEmbed("open canvas embed: missing custom canvas path", { attrs, blockId })
    }
    return canvasPath
  } catch {
    debugCanvasEmbed("open canvas embed: failed to read block attrs", { blockId })
    return ""
  }
}

function findClickedImageBlockId(target: EventTarget | null): string {
  const element = target && "closest" in target ? target as Element : null
  const image = element?.closest("img")
  if (!image) return ""
  return image.closest<HTMLElement>("[data-node-id]")?.getAttribute("data-node-id") || ""
}

function findClickedCanvasEmbedPath(target: EventTarget | null): string {
  const element = target && "closest" in target ? target as Element : null
  const embed = element?.closest<HTMLElement>(`.${CANVAS_EMBED_CLASS}`)
  return normalizeCanvasPath(embed?.dataset.canvasPath || "")
}

function findCanvasEmbedPathInDocument(doc: Document): string {
  const embed = doc.querySelector<HTMLElement>(`.${CANVAS_EMBED_CLASS}[data-canvas-path]`)
  return normalizeCanvasPath(embed?.dataset.canvasPath || "")
}

async function openCanvasFromBlockId(event: MouseEvent, blockId: string, plugin: Plugin, pluginName: string) {
  if (!blockId) {
    debugCanvasEmbed("open canvas embed: missing block id")
    return
  }

  const canvasPath = await getCanvasPathFromBlockAttrs(blockId)
  if (!canvasPath) return

  debugCanvasEmbed("open canvas embed", { blockId, path: canvasPath })
  event.preventDefault()
  event.stopPropagation()
  void openCanvasEditorTab(plugin, pluginName, { path: canvasPath }, "Untitled.canvas")
}

function openCanvasFromPath(event: MouseEvent, canvasPath: string, plugin: Plugin, pluginName: string) {
  const normalizedPath = normalizeCanvasPath(canvasPath)
  if (!normalizedPath) return

  event.preventDefault()
  event.stopPropagation()
  debugCanvasEmbed("open canvas embed from path", { path: normalizedPath })
  void openCanvasEditorTab(plugin, pluginName, { path: normalizedPath }, "Untitled.canvas")
}

async function openCanvasFromClickedImage(event: MouseEvent, plugin: Plugin, pluginName: string) {
  const blockId = findClickedImageBlockId(event.target)
  if (blockId) {
    await openCanvasFromBlockId(event, blockId, plugin, pluginName)
    return
  }

  const canvasPath = findClickedCanvasEmbedPath(event.target)
  if (canvasPath) {
    openCanvasFromPath(event, canvasPath, plugin, pluginName)
    return
  }

  debugCanvasEmbed("open canvas embed: missing block id")
}

async function ensureIframeClickOverlay(
  iframe: HTMLIFrameElement,
  blockId: string,
  plugin: Plugin,
  pluginName: string,
  fallbackCanvasPath = "",
) {
  const block = iframe.closest<HTMLElement>("[data-node-id]")
  const host = iframe.parentElement || block
  if (!host || host.querySelector(`[${CANVAS_EMBED_IFRAME_OVERLAY_ATTR}="true"]`)) {
    return
  }

  const canvasPath = normalizeCanvasPath(fallbackCanvasPath) || await getCanvasPathFromBlockAttrs(blockId)
  if (!canvasPath) return

  if (!host.style.position) {
    host.style.position = "relative"
  }

  const overlay = document.createElement("div")
  overlay.setAttribute(CANVAS_EMBED_IFRAME_OVERLAY_ATTR, "true")
  overlay.title = "Open Canvas"
  overlay.style.position = "absolute"
  overlay.style.inset = "0"
  overlay.style.zIndex = "2"
  overlay.style.cursor = "pointer"
  overlay.style.background = "transparent"
  overlay.addEventListener("click", (event) => {
    debugCanvasEmbed("iframe canvas embed overlay clicked", { blockId, path: canvasPath })
    openCanvasFromPath(event, canvasPath, plugin, pluginName)
  }, true)
  host.appendChild(overlay)
  debugCanvasEmbed("created iframe canvas embed overlay", { blockId, path: canvasPath })
}

function bindHtmlBlockIframeClicks(root: Element | Document, plugin: Plugin, pluginName: string) {
  const iframes = root.querySelectorAll<HTMLIFrameElement>("iframe")
  for (const iframe of iframes) {
    const blockId = iframe.closest<HTMLElement>("[data-node-id]")?.getAttribute("data-node-id") || ""
    void ensureIframeClickOverlay(iframe, blockId, plugin, pluginName)

    const bindCurrentDocument = () => {
      const iframeDocument = iframe.contentDocument
      if (!iframeDocument || iframeClickListeners.has(iframeDocument)) {
        return
      }

      const documentCanvasPath = findCanvasEmbedPathInDocument(iframeDocument)
      if (documentCanvasPath) {
        void ensureIframeClickOverlay(iframe, blockId, plugin, pluginName, documentCanvasPath)
      }

      const listener = (event: MouseEvent) => {
        const target = event.target && "closest" in event.target ? event.target as Element : null
        const canvasPath = findClickedCanvasEmbedPath(event.target) || documentCanvasPath
        debugCanvasEmbed("iframe document clicked", {
          blockId,
          hasCanvasPath: Boolean(canvasPath),
          tagName: target?.tagName || "",
        })
        if (!canvasPath && !blockId) return

        if (blockId) {
          void openCanvasFromBlockId(event, blockId, plugin, pluginName)
          return
        }

        if (canvasPath) {
          openCanvasFromPath(event, canvasPath, plugin, pluginName)
          return
        }

        debugCanvasEmbed("iframe document clicked without path", { blockId })
      }
      iframeClickListeners.set(iframeDocument, listener)
      iframeDocument.addEventListener("click", listener, true)
      debugCanvasEmbed("bound iframe canvas embed clicks", { blockId })
    }

    bindCurrentDocument()

    if (!iframeLoadListeners.has(iframe)) {
      const loadListener = () => {
        void ensureIframeClickOverlay(iframe, blockId, plugin, pluginName)
        bindCurrentDocument()
        window.setTimeout(bindCurrentDocument, 0)
      }
      iframeLoadListeners.set(iframe, loadListener)
      iframe.addEventListener("load", loadListener)
    }

    window.setTimeout(bindCurrentDocument, 0)
    window.setTimeout(bindCurrentDocument, 300)
    window.setTimeout(() => {
      void ensureIframeClickOverlay(iframe, blockId, plugin, pluginName)
    }, 300)
  }
}

interface CanvasEmbedBlockRef {
  blockId: string
  rootId: string
}

function escapeSqlString(value: string): string {
  return value.replace(/'/g, "''")
}

async function findCanvasEmbedBlockRefsByPath(path: string): Promise<CanvasEmbedBlockRef[]> {
  let rows: Array<{ block_id?: string, root_id?: string }> | null = null
  try {
    rows = await sql(
      `SELECT block_id, root_id FROM attributes WHERE name = 'custom-canvas-path' AND value = '${escapeSqlString(path)}' LIMIT 100`,
    ) as Array<{ block_id?: string, root_id?: string }> | null
  } catch {
    rows = null
  }

  return (rows || [])
    .map(row => ({
      blockId: row.block_id || "",
      rootId: row.root_id || "",
    }))
    .filter(row => Boolean(row.blockId))
}

async function refreshCanvasEmbedsForPath(path: string) {
  if (!path) return

  const visibleEmbeds = [...document.querySelectorAll<HTMLElement>(`.${CANVAS_EMBED_CLASS}`)]
    .filter(element => element.dataset.canvasPath === path)
  const domBlockIds = visibleEmbeds
    .map(findCanvasEmbedBlockId)
    .filter(Boolean)
  const attributeBlockRefs = await findCanvasEmbedBlockRefsByPath(path)
  const attributeBlockIds = attributeBlockRefs.map(ref => ref.blockId)
  const blockIds = new Set([...domBlockIds, ...attributeBlockIds])

  debugCanvasEmbed("refresh canvas embeds", {
    attributeBlockIds,
    blockIds: [...blockIds],
    domBlockIds,
    path,
  })

  if (blockIds.size === 0) return

  const raw = await getFileText(path)
  if (!raw) {
    debugCanvasEmbed("refresh canvas embeds: unable to read canvas", { path })
    return
  }

  const result = parseCanvasDocument(raw)
  if (!result.document || result.errors.length > 0) {
    debugCanvasEmbed("refresh canvas embeds: invalid canvas", { errors: result.errors, path })
    return
  }

  const dataUrl = generateCanvasEmbedDataUrl(result.document)
  if (!dataUrl) {
    debugCanvasEmbed("refresh canvas embeds: empty preview", { path })
    return
  }

  for (const element of visibleEmbeds) {
    const image = element.querySelector<HTMLImageElement>("img")
    if (!image) {
      continue
    }

    image.src = dataUrl
    debugCanvasEmbed("refresh visible canvas embed image", {
      blockId: findCanvasEmbedBlockId(element),
      path,
    })
  }
}

export function startCanvasEmbedObserver(plugin: Plugin, pluginName: string) {
  if (observer) return

  observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node instanceof HTMLElement) {
          if (node.classList.contains(CANVAS_EMBED_CLASS)) {
            bindCanvasEmbedClick(node, plugin, pluginName)
          }
          scanAndBind(node, plugin, pluginName)
          bindHtmlBlockIframeClicks(node, plugin, pluginName)
        }
      }
    }
  })

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  })

  refreshListener = (event: Event) => {
    const detail = (event as CustomEvent<CanvasEmbedRefreshEventDetail>).detail
    void refreshCanvasEmbedsForPath(detail?.path || "")
  }
  window.addEventListener(CANVAS_EMBED_REFRESH_EVENT, refreshListener)
  delegatedClickListener = (event: MouseEvent) => {
    void openCanvasFromClickedImage(event, plugin, pluginName)
  }
  document.addEventListener("click", delegatedClickListener, true)

  scanAndBind(document.body, plugin, pluginName)
  bindHtmlBlockIframeClicks(document, plugin, pluginName)
}

export function stopCanvasEmbedObserver() {
  observer?.disconnect()
  observer = null
  if (refreshListener) {
    window.removeEventListener(CANVAS_EMBED_REFRESH_EVENT, refreshListener)
    refreshListener = null
  }
  if (delegatedClickListener) {
    document.removeEventListener("click", delegatedClickListener, true)
    delegatedClickListener = null
  }
  document.querySelectorAll(`[${CANVAS_EMBED_IFRAME_OVERLAY_ATTR}="true"]`).forEach((element) => {
    element.remove()
  })
}
