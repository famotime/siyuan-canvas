import { Dialog } from "siyuan"
import { readDir } from "@/api"

export type CanvasFilePickerMode = "preview" | "link"

export interface CanvasFilePickerResult {
  path: string
  mode: CanvasFilePickerMode
}

export interface CanvasFilePickerDialogOptions {
  cancelLabel: string
  confirmLabel: string
  noResultsLabel: string
  searchPlaceholder: string
  title: string
  defaultDirectory: string
  insertLinkSwitchLabel?: string
}

interface CanvasFileEntry {
  name: string
  path: string
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
}

function escapeAttr(value: string): string {
  return escapeHtml(value)
}

async function collectCanvasFiles(dirPath: string, isRoot = true): Promise<CanvasFileEntry[]> {
  let entries: Array<{ isDir: boolean, name: string }>
  try {
    entries = (await readDir(dirPath)) ?? []
  } catch (error) {
    if (isRoot) {
      throw error
    }
    return []
  }

  const files: CanvasFileEntry[] = []
  for (const entry of entries) {
    const fullPath = `${dirPath}/${entry.name}`
    if (entry.isDir) {
      files.push(...await collectCanvasFiles(fullPath, false))
    } else if (entry.name.endsWith(".canvas")) {
      files.push({ name: entry.name, path: fullPath })
    }
  }
  return files
}

function buildListItem(entry: CanvasFileEntry, index: number, isActive: boolean): string {
  const activeClass = isActive ? " canvas-file-picker__item--active" : ""
  return `<div class="canvas-file-picker__item${activeClass}" data-canvas-file-picker-index="${index}" data-path="${escapeAttr(entry.path)}">
    <div class="canvas-file-picker__item-name">${escapeHtml(entry.name)}</div>
    <div class="canvas-file-picker__item-path">${escapeHtml(entry.path)}</div>
  </div>`
}

export function openCanvasFilePickerDialog(options: CanvasFilePickerDialogOptions): Promise<CanvasFilePickerResult | null> {
  return new Promise((resolve) => {
    let settled = false
    let loadState: "loading" | "ready" | "error" = "loading"
    let allFiles: CanvasFileEntry[] = []
    let filteredFiles: CanvasFileEntry[] = []
    let activeIndex = 0

    const dialog = new Dialog({
      title: options.title,
      width: "560px",
      content: `
        <div class="canvas-file-picker">
          <input
            class="b3-text-field fn__block canvas-file-picker__input"
            data-canvas-file-picker-input
            placeholder="${escapeAttr(options.searchPlaceholder)}"
          >
          <div class="canvas-file-picker__list" data-canvas-file-picker-list>
            <div class="canvas-file-picker__loading">…</div>
          </div>
          <div class="canvas-file-picker__actions">
            <label class="canvas-file-picker__mode-toggle">
              <input
                class="b3-switch fn__flex-center"
                data-canvas-file-picker-mode-switch
                type="checkbox"
              >
              <span class="canvas-file-picker__mode-label">${escapeHtml(options.insertLinkSwitchLabel || "插入链接")}</span>
            </label>
            <div class="canvas-file-picker__buttons">
              <button class="b3-button b3-button--outline" data-canvas-file-picker-cancel type="button">${escapeHtml(options.cancelLabel)}</button>
              <button class="b3-button" data-canvas-file-picker-confirm type="button">${escapeHtml(options.confirmLabel)}</button>
            </div>
          </div>
        </div>
      `,
      destroyCallback: () => {
        if (settled) {
          return
        }

        settled = true
        resolve(null)
      },
    })

    const input = dialog.element.querySelector("[data-canvas-file-picker-input]") as HTMLInputElement | null
    const listEl = dialog.element.querySelector("[data-canvas-file-picker-list]") as HTMLElement | null
    const cancelButton = dialog.element.querySelector("[data-canvas-file-picker-cancel]") as HTMLButtonElement | null
    const confirmButton = dialog.element.querySelector("[data-canvas-file-picker-confirm]") as HTMLButtonElement | null
    const modeSwitch = dialog.element.querySelector("[data-canvas-file-picker-mode-switch]") as HTMLInputElement | null

    const getMode = (): CanvasFilePickerMode => {
      return modeSwitch?.checked ? "link" : "preview"
    }

    const close = (value: CanvasFilePickerResult | null) => {
      if (settled) {
        return
      }

      settled = true
      resolve(value)
      dialog.destroy()
    }

    function renderList() {
      if (!listEl) return
      listEl.dataset.loadState = loadState

      if (loadState === "loading") {
        listEl.innerHTML = `<div class="canvas-file-picker__loading">…</div>`
        return
      }

      if (loadState === "error") {
        listEl.innerHTML = `<div class="canvas-file-picker__empty canvas-file-picker__error">${escapeHtml(options.noResultsLabel)}</div>`
        return
      }

      if (filteredFiles.length === 0) {
        listEl.innerHTML = `<div class="canvas-file-picker__empty">${escapeHtml(options.noResultsLabel)}</div>`
        return
      }

      const clampedIndex = Math.max(0, Math.min(filteredFiles.length - 1, activeIndex))
      activeIndex = clampedIndex
      listEl.innerHTML = filteredFiles
        .map((entry, i) => buildListItem(entry, i, i === clampedIndex))
        .join("")
    }

    function filterFiles() {
      if (loadState !== "ready") {
        return
      }
      const query = (input?.value ?? "").trim().toLowerCase()
      filteredFiles = allFiles.filter((entry) => {
        if (!query) return true
        return entry.name.toLowerCase().includes(query)
          || entry.path.toLowerCase().includes(query)
      })
      activeIndex = 0
      renderList()
    }

    function scrollActiveIntoView() {
      if (!listEl) return
      const activeItem = listEl.querySelector(".canvas-file-picker__item--active") as HTMLElement | null
      if (activeItem && typeof activeItem.scrollIntoView === "function") {
        activeItem.scrollIntoView({ block: "nearest" })
      }
    }

    function confirmSelection() {
      const trimmed = (input?.value ?? "").trim()
      const mode = getMode()
      if (filteredFiles.length > 0 && filteredFiles[activeIndex]) {
        close({ path: filteredFiles[activeIndex].path, mode })
      } else if (trimmed) {
        close({ path: trimmed, mode })
      }
    }

    // Event listeners
    cancelButton?.addEventListener("click", () => {
      close(null)
    })

    confirmButton?.addEventListener("click", () => {
      confirmSelection()
    })

    input?.addEventListener("input", () => {
      filterFiles()
    })

    input?.addEventListener("keydown", (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        close(null)
      } else if (event.key === "ArrowDown") {
        event.preventDefault()
        if (filteredFiles.length === 0) {
          activeIndex = 0
          return
        }
        activeIndex = Math.min(filteredFiles.length - 1, activeIndex + 1)
        renderList()
        scrollActiveIntoView()
      } else if (event.key === "ArrowUp") {
        event.preventDefault()
        if (filteredFiles.length === 0) {
          activeIndex = 0
          return
        }
        activeIndex = Math.max(0, activeIndex - 1)
        renderList()
        scrollActiveIntoView()
      } else if (event.key === "Enter") {
        event.preventDefault()
        confirmSelection()
      }
    })

    listEl?.addEventListener("click", (event) => {
      const target = (event.target as HTMLElement).closest("[data-canvas-file-picker-index]") as HTMLElement | null
      if (!target) return

      const index = Number(target.dataset.canvasFilePickerIndex)
      if (!Number.isNaN(index) && index >= 0 && index < filteredFiles.length) {
        close({ path: filteredFiles[index].path, mode: getMode() })
      }
    })

    listEl?.addEventListener("mousemove", (event) => {
      const target = (event.target as HTMLElement).closest("[data-canvas-file-picker-index]") as HTMLElement | null
      if (!target) return

      const index = Number(target.dataset.canvasFilePickerIndex)
      if (!Number.isNaN(index) && index >= 0 && index < filteredFiles.length && index !== activeIndex) {
        activeIndex = index
        renderList()
      }
    })

    // Load files and initialize
    renderList()
    queueMicrotask(() => {
      input?.focus()
    })

    collectCanvasFiles(options.defaultDirectory, true).then((files) => {
      if (settled) return

      loadState = "ready"
      allFiles = files
      filterFiles()
    }).catch(() => {
      if (settled) return

      loadState = "error"
      allFiles = []
      filteredFiles = []
      activeIndex = 0
      renderList()
    })
  })
}
