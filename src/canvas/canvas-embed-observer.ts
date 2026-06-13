import type { Plugin } from "siyuan"
import type { CanvasEmbedRefreshEventDetail } from "@/canvas/canvas-embed-events"
import { getAllEditor } from "siyuan"
import {
  getBlockAttrs,
  getFileText,
  sql,
} from "@/api"
import { CANVAS_EMBED_REFRESH_EVENT } from "@/canvas/canvas-embed-events"
import {
  CANVAS_EMBED_BOUND_ATTR,
  CANVAS_EMBED_CLASS,
  refreshCanvasEmbedBlock,
} from "@/canvas/canvas-embed-insert"
import { generateCanvasEmbedDataUrl } from "@/canvas/canvas-embed-preview"
import { parseCanvasDocument } from "@/canvas/format"
import { openCanvasEditorTab } from "@/canvas/plugin-tabs"

let observer: MutationObserver | null = null
let refreshListener: ((event: Event) => void) | null = null
let delegatedClickListener: ((event: MouseEvent) => void) | null = null
const iframeClickListeners = new WeakMap<Document, (event: MouseEvent) => void>()
const iframeLoadListeners = new WeakMap<HTMLIFrameElement, () => void>()
const CANVAS_EMBED_IFRAME_OVERLAY_ATTR = "data-canvas-embed-iframe-overlay"

let debugEnabled = false

export function setCanvasEmbedDebugEnabled(enabled: boolean): void {
  debugEnabled = enabled
}

function debugCanvasEmbed(message: string, data?: Record<string, unknown>) {
  if (!debugEnabled) return
  console.debug(`[siyuan-canvas] ${message}`, data || {})
}

function bindCanvasEmbedClick(element: HTMLElement, plugin: Plugin, pluginName: string) {
  if (element.getAttribute(CANVAS_EMBED_BOUND_ATTR) === "true") return

  const canvasPath = normalizeCanvasPath(element.dataset.canvasPath || "")
  if (!canvasPath) return

  element.setAttribute(CANVAS_EMBED_BOUND_ATTR, "true")
  element.style.cursor = "pointer"

  const openHandler = (event: Event) => {
    event.preventDefault()
    event.stopPropagation()
    void openCanvasEditorTab(plugin, pluginName, { path: canvasPath }, "Untitled.canvas")
  }
  element.addEventListener("click", openHandler)
  element.addEventListener("touchend", openHandler)
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

function isElement(value: unknown): value is Element {
  return value instanceof Element
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
      debugCanvasEmbed("open canvas embed: missing custom canvas path", {
        attrs,
        blockId,
      })
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

function getEventElements(event: Event): Element[] {
  const path = typeof event.composedPath === "function" ? event.composedPath() : []
  const elements = path.filter(isElement)
  const target = event.target instanceof Element ? event.target : null
  if (target && !elements.includes(target)) {
    elements.unshift(target)
  }
  return elements
}

function findCanvasEmbedPathFromElements(elements: Element[]): string {
  for (const element of elements) {
    if (element instanceof HTMLElement) {
      const directPath = normalizeCanvasPath(element.dataset.canvasPath || "")
      if (directPath) return directPath
    }

    const embed = element.closest?.<HTMLElement>(`.${CANVAS_EMBED_CLASS}[data-canvas-path]`)
    const embedPath = normalizeCanvasPath(embed?.dataset.canvasPath || "")
    if (embedPath) return embedPath
  }
  return ""
}

function findBlockIdFromElements(elements: Element[]): string {
  for (const element of elements) {
    const blockId = element.closest?.<HTMLElement>("[data-node-id]")?.getAttribute("data-node-id") || ""
    if (blockId) return blockId
  }
  return ""
}

function summarizeElements(elements: Element[]): string[] {
  return elements.slice(0, 8).map((element) => {
    const id = element.id ? `#${element.id}` : ""
    const classes = element.className && typeof element.className === "string"
      ? `.${element.className.split(/\s+/).filter(Boolean).slice(0, 3).join(".")}`
      : ""
    const nodeId = element instanceof HTMLElement && element.dataset.nodeId ? `[data-node-id=${element.dataset.nodeId}]` : ""
    const canvasPath = element instanceof HTMLElement && element.dataset.canvasPath ? "[data-canvas-path]" : ""
    return `${element.tagName.toLowerCase()}${id}${classes}${nodeId}${canvasPath}`
  })
}

function findCanvasEmbedPathInDocument(doc: Document): string {
  const embed = doc.querySelector<HTMLElement>(`.${CANVAS_EMBED_CLASS}[data-canvas-path]`)
  return normalizeCanvasPath(embed?.dataset.canvasPath || "")
}

async function openCanvasFromBlockId(event: Event, blockId: string, plugin: Plugin, pluginName: string) {
  if (!blockId) {
    debugCanvasEmbed("open canvas embed: missing block id")
    return
  }

  const canvasPath = await getCanvasPathFromBlockAttrs(blockId)
  if (!canvasPath) return

  debugCanvasEmbed("open canvas embed", {
    blockId,
    path: canvasPath,
  })
  event.preventDefault()
  event.stopPropagation()
  void openCanvasEditorTab(plugin, pluginName, { path: canvasPath }, "Untitled.canvas")
}

async function openCanvasFromBlockIdOrPath(
  event: Event,
  blockId: string,
  fallbackCanvasPath: string,
  plugin: Plugin,
  pluginName: string,
) {
  const canvasPathFromBlock = blockId ? await getCanvasPathFromBlockAttrs(blockId) : ""
  const canvasPath = canvasPathFromBlock || normalizeCanvasPath(fallbackCanvasPath)
  if (!canvasPath) {
    debugCanvasEmbed("open canvas embed: missing canvas path", {
      blockId,
      hasFallbackPath: Boolean(fallbackCanvasPath),
    })
    return
  }

  event.preventDefault()
  event.stopPropagation()
  debugCanvasEmbed("open canvas embed", {
    blockId,
    path: canvasPath,
    source: canvasPathFromBlock ? "block-attrs" : "fallback-path",
  })
  void openCanvasEditorTab(plugin, pluginName, { path: canvasPath }, "Untitled.canvas")
}

function openCanvasFromPath(event: Event, canvasPath: string, plugin: Plugin, pluginName: string) {
  const normalizedPath = normalizeCanvasPath(canvasPath)
  if (!normalizedPath) return

  event.preventDefault()
  event.stopPropagation()
  debugCanvasEmbed("open canvas embed from path", { path: normalizedPath })
  void openCanvasEditorTab(plugin, pluginName, { path: normalizedPath }, "Untitled.canvas")
}

async function openCanvasFromClickedImage(event: Event, plugin: Plugin, pluginName: string) {
  const elements = getEventElements(event)
  const blockId = findBlockIdFromElements(elements)
  const canvasPath = findCanvasEmbedPathFromElements(elements)
  if (blockId || canvasPath) {
    debugCanvasEmbed("document canvas embed click candidate", {
      blockId,
      hasCanvasPath: Boolean(canvasPath),
      path: summarizeElements(elements),
    })
  }

  if (blockId) {
    await openCanvasFromBlockIdOrPath(event, blockId, canvasPath, plugin, pluginName)
    return
  }

  if (canvasPath) {
    openCanvasFromPath(event, canvasPath, plugin, pluginName)
  }
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
  const overlayHandler = (event: Event) => {
    debugCanvasEmbed("iframe canvas embed overlay clicked", {
      blockId,
      path: canvasPath,
    })
    openCanvasFromPath(event, canvasPath, plugin, pluginName)
  }
  overlay.addEventListener("click", overlayHandler, true)
  overlay.addEventListener("touchend", overlayHandler, true)
  host.appendChild(overlay)
  debugCanvasEmbed("created iframe canvas embed overlay", {
    blockId,
    path: canvasPath,
  })
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

      const listener = (event: Event) => {
        const elements = getEventElements(event)
        const target = elements[0]
        const canvasPath = findCanvasEmbedPathFromElements(elements) || documentCanvasPath
        debugCanvasEmbed("iframe document clicked", {
          blockId,
          hasCanvasPath: Boolean(canvasPath),
          tagName: target?.tagName || "",
        })
        if (!canvasPath && !blockId) return

        if (blockId) {
          void openCanvasFromBlockIdOrPath(event, blockId, canvasPath, plugin, pluginName)
          return
        }

        if (canvasPath) {
          openCanvasFromPath(event, canvasPath, plugin, pluginName)
          return
        }

        debugCanvasEmbed("iframe document clicked without path", { blockId })
      }
      iframeClickListeners.set(iframeDocument, listener as (e: MouseEvent) => void)
      iframeDocument.addEventListener("click", listener, true)
      iframeDocument.addEventListener("touchend", listener, true)
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

interface VisibleCanvasEmbedRef {
  blockId: string
  element: HTMLElement
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
    .map((row) => ({
      blockId: row.block_id || "",
      rootId: row.root_id || "",
    }))
    .filter((row) => Boolean(row.blockId))
}

function collectVisibleCanvasEmbedsByPath(path: string): VisibleCanvasEmbedRef[] {
  const normalizedPath = normalizeCanvasPath(path)
  const topLevelEmbeds = [...document.querySelectorAll<HTMLElement>(`.${CANVAS_EMBED_CLASS}`)]
    .filter((element) => normalizeCanvasPath(element.dataset.canvasPath || "") === normalizedPath)
    .map((element) => ({
      blockId: findCanvasEmbedBlockId(element),
      element,
    }))

  const iframeEmbeds = [...document.querySelectorAll<HTMLIFrameElement>("iframe")]
    .flatMap((iframe) => {
      const iframeDocument = iframe.contentDocument
      if (!iframeDocument) return []

      const blockId = iframe.closest<HTMLElement>("[data-node-id]")?.getAttribute("data-node-id") || ""
      return [...iframeDocument.querySelectorAll<HTMLElement>(`.${CANVAS_EMBED_CLASS}`)]
        .filter((element) => normalizeCanvasPath(element.dataset.canvasPath || "") === normalizedPath)
        .map((element) => ({
          blockId,
          element,
        }))
    })

  return [...topLevelEmbeds, ...iframeEmbeds]
}

function getCanvasEmbedTitle(element: HTMLElement): string {
  return element.querySelector<HTMLElement>(".canvas-embed-title")?.textContent?.trim() || ""
}

function reloadOpenEditors(rootIds: Set<string>) {
  if (rootIds.size === 0) return

  for (const editor of getAllEditor?.() || []) {
    const rootId = editor?.protyle?.block?.rootID || editor?.protyle?.block?.id || ""
    if (!rootIds.has(rootId)) continue

    editor.reload?.()
  }
}

async function refreshCanvasEmbedsForPath(path: string) {
  const normalizedPath = normalizeCanvasPath(path)
  if (!normalizedPath) return

  const visibleEmbeds = collectVisibleCanvasEmbedsByPath(normalizedPath)
  const domBlockIds = visibleEmbeds
    .map((ref) => ref.blockId)
    .filter(Boolean)
  const attributeBlockRefs = await findCanvasEmbedBlockRefsByPath(normalizedPath)
  const attributeBlockIds = attributeBlockRefs.map((ref) => ref.blockId)
  const blockIds = new Set([...domBlockIds, ...attributeBlockIds])
  const visibleEmbedByBlockId = new Map(
    visibleEmbeds
      .filter((ref) => ref.blockId)
      .map((ref) => [ref.blockId, ref.element]),
  )

  debugCanvasEmbed("refresh canvas embeds", {
    attributeBlockIds,
    blockIds: [...blockIds],
    domBlockIds,
    path: normalizedPath,
  })

  if (blockIds.size === 0) return

  const raw = await getFileText(normalizedPath)
  if (!raw) {
    debugCanvasEmbed("refresh canvas embeds: unable to read canvas", { path: normalizedPath })
    return
  }

  const result = parseCanvasDocument(raw)
  if (!result.document || result.errors.length > 0) {
    debugCanvasEmbed("refresh canvas embeds: invalid canvas", {
      errors: result.errors,
      path: normalizedPath,
    })
    return
  }

  const dataUrl = generateCanvasEmbedDataUrl(result.document)
  if (!dataUrl) {
    debugCanvasEmbed("refresh canvas embeds: empty preview", { path: normalizedPath })
    return
  }

  for (const blockId of blockIds) {
    const visibleEmbed = visibleEmbedByBlockId.get(blockId)
    await refreshCanvasEmbedBlock(
      blockId,
      normalizedPath,
      raw,
      visibleEmbed ? getCanvasEmbedTitle(visibleEmbed) : undefined,
    )
  }

  const rootIdsToReload = new Set(
    attributeBlockRefs
      .filter((ref) => ref.rootId && !domBlockIds.includes(ref.blockId))
      .map((ref) => ref.rootId),
  )
  reloadOpenEditors(rootIdsToReload)

  for (const {
    blockId,
    element,
  } of visibleEmbeds) {
    const image = element.querySelector<HTMLImageElement>("img")
    if (!image) {
      continue
    }

    image.src = dataUrl
    debugCanvasEmbed("refresh visible canvas embed image", {
      blockId,
      path: normalizedPath,
    })
  }
}

export function startCanvasEmbedObserver(plugin: Plugin, pluginName: string, options?: { debugLogEnabled?: boolean }): void {
  if (observer) return

  debugEnabled = options?.debugLogEnabled ?? false

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
  delegatedClickListener = (event: Event) => {
    void openCanvasFromClickedImage(event, plugin, pluginName)
  }
  document.addEventListener("click", delegatedClickListener, true)
  document.addEventListener("touchend", delegatedClickListener, true)

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
    document.removeEventListener("touchend", delegatedClickListener, true)
    delegatedClickListener = null
  }
  document.querySelectorAll(`[${CANVAS_EMBED_IFRAME_OVERLAY_ATTR}="true"]`).forEach((element) => {
    element.remove()
  })
}
