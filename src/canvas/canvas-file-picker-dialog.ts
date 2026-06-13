import { Dialog } from "siyuan"
import { readDir } from "@/api"

interface CanvasFilePickerDialogOptions {
  cancelLabel: string
  confirmLabel: string
  noResultsLabel: string
  searchPlaceholder: string
  title: string
  defaultDirectory: string
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

async function collectCanvasFiles(dirPath: string): Promise<CanvasFileEntry[]> {
  let entries: Array<{ isDir: boolean, name: string }>
  try {
    entries = (await readDir(dirPath)) ?? []
  } catch {
    return []
  }

  const files: CanvasFileEntry[] = []
  for (const entry of entries) {
    const fullPath = `${dirPath}/${entry.name}`
    if (entry.isDir) {
      files.push(...await collectCanvasFiles(fullPath))
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

export function openCanvasFilePickerDialog(options: CanvasFilePickerDialogOptions): Promise<string | null> {
  return new Promise((resolve) => {
    let settled = false
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
            <button class="b3-button b3-button--outline" data-canvas-file-picker-cancel type="button">${escapeHtml(options.cancelLabel)}</button>
            <button class="b3-button" data-canvas-file-picker-confirm type="button">${escapeHtml(options.confirmLabel)}</button>
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

    const close = (value: string | null) => {
      if (settled) {
        return
      }

      settled = true
      resolve(value)
      dialog.destroy()
    }

    function renderList() {
      if (!listEl) return

      if (filteredFiles.length === 0) {
        listEl.innerHTML = `<div class="canvas-file-picker__empty">${escapeHtml(options.noResultsLabel)}</div>`
        return
      }

      listEl.innerHTML = filteredFiles
        .map((entry, i) => buildListItem(entry, i, i === activeIndex))
        .join("")
    }

    function filterFiles() {
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
      if (filteredFiles.length > 0 && filteredFiles[activeIndex]) {
        close(filteredFiles[activeIndex].path)
      } else if (trimmed) {
        close(trimmed)
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
        return
      }

      if (event.key === "ArrowDown") {
        event.preventDefault()
        activeIndex = Math.min(filteredFiles.length - 1, activeIndex + 1)
        renderList()
        scrollActiveIntoView()
        return
      }

      if (event.key === "ArrowUp") {
        event.preventDefault()
        activeIndex = Math.max(0, activeIndex - 1)
        renderList()
        scrollActiveIntoView()
        return
      }

      if (event.key === "Enter") {
        event.preventDefault()
        confirmSelection()
      }
    })

    listEl?.addEventListener("click", (event) => {
      const target = (event.target as HTMLElement).closest("[data-canvas-file-picker-index]") as HTMLElement | null
      if (!target) return

      const index = Number(target.dataset.canvasFilePickerIndex)
      if (!Number.isNaN(index) && index >= 0 && index < filteredFiles.length) {
        close(filteredFiles[index].path)
      }
    })

    listEl?.addEventListener("mousemove", (event) => {
      const target = (event.target as HTMLElement).closest("[data-canvas-file-picker-index]") as HTMLElement | null
      if (!target) return

      const index = Number(target.dataset.canvasFilePickerIndex)
      if (!Number.isNaN(index) && index !== activeIndex) {
        activeIndex = index
        renderList()
      }
    })

    // Load files and initialize
    queueMicrotask(() => {
      input?.focus()
    })

    collectCanvasFiles(options.defaultDirectory).then((files) => {
      if (settled) return

      allFiles = files
      filteredFiles = files
      activeIndex = 0
      renderList()
    })
  })
}
