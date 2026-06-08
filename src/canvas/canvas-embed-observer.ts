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

function bindCanvasEmbedClick(element: HTMLElement, plugin: Plugin, pluginName: string) {
  if (element.getAttribute(CANVAS_EMBED_BOUND_ATTR) === "true") return

  const canvasPath = element.dataset.canvasPath
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

async function getCanvasPathFromBlockAttrs(blockId: string): Promise<string> {
  if (!blockId) return ""

  try {
    const attrs = await getBlockAttrs(blockId)
    return attrs?.["custom-canvas-path"] || ""
  } catch {
    return ""
  }
}

function findClickedImageBlockId(target: EventTarget | null): string {
  const element = target && "closest" in target ? target as Element : null
  const image = element?.closest("img")
  if (!image) return ""
  return image.closest<HTMLElement>("[data-node-id]")?.getAttribute("data-node-id") || ""
}

async function openCanvasFromBlockId(event: MouseEvent, blockId: string, plugin: Plugin, pluginName: string) {
  if (!blockId) return

  const canvasPath = await getCanvasPathFromBlockAttrs(blockId)
  if (!canvasPath) return

  event.preventDefault()
  event.stopPropagation()
  void openCanvasEditorTab(plugin, pluginName, { path: canvasPath }, "Untitled.canvas")
}

async function openCanvasFromClickedImage(event: MouseEvent, plugin: Plugin, pluginName: string) {
  await openCanvasFromBlockId(event, findClickedImageBlockId(event.target), plugin, pluginName)
}

function bindHtmlBlockIframeClicks(root: Element | Document, plugin: Plugin, pluginName: string) {
  const iframes = root.querySelectorAll<HTMLIFrameElement>("iframe")
  for (const iframe of iframes) {
    const blockId = iframe.closest<HTMLElement>("[data-node-id]")?.getAttribute("data-node-id") || ""
    const iframeDocument = iframe.contentDocument
    if (!blockId || !iframeDocument || iframeClickListeners.has(iframeDocument)) {
      continue
    }

    const listener = (event: MouseEvent) => {
      const target = event.target && "closest" in event.target ? event.target as Element : null
      if (!target?.closest("img")) {
        return
      }
      void openCanvasFromBlockId(event, blockId, plugin, pluginName)
    }
    iframeClickListeners.set(iframeDocument, listener)
    iframeDocument.addEventListener("click", listener, true)
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

  console.debug("[siyuan-canvas] refresh canvas embeds", {
    attributeBlockIds,
    blockIds: [...blockIds],
    domBlockIds,
    path,
  })

  if (blockIds.size === 0) return

  const raw = await getFileText(path)
  if (!raw) {
    console.debug("[siyuan-canvas] refresh canvas embeds: unable to read canvas", { path })
    return
  }

  const result = parseCanvasDocument(raw)
  if (!result.document || result.errors.length > 0) {
    console.debug("[siyuan-canvas] refresh canvas embeds: invalid canvas", { errors: result.errors, path })
    return
  }

  const dataUrl = generateCanvasEmbedDataUrl(result.document)
  if (!dataUrl) {
    console.debug("[siyuan-canvas] refresh canvas embeds: empty preview", { path })
    return
  }

  for (const element of visibleEmbeds) {
    const image = element.querySelector<HTMLImageElement>("img")
    if (!image) {
      continue
    }

    image.src = dataUrl
    console.debug("[siyuan-canvas] refresh visible canvas embed image", {
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
}
