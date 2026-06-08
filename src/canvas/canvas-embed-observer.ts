import type { Plugin } from "siyuan"
import { CANVAS_EMBED_BOUND_ATTR, CANVAS_EMBED_CLASS } from "@/canvas/canvas-embed-insert"
import { openCanvasEditorTab } from "@/canvas/plugin-tabs"

let observer: MutationObserver | null = null

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
        }
      }
    }
  })

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  })

  scanAndBind(document.body, plugin, pluginName)
}

export function stopCanvasEmbedObserver() {
  observer?.disconnect()
  observer = null
}
