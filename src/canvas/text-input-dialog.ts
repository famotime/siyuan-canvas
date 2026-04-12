import { Dialog } from "siyuan"

interface TextInputDialogOptions {
  cancelLabel: string
  confirmLabel: string
  initialValue: string
  title: string
  width?: string
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
}

export function openTextInputDialog(options: TextInputDialogOptions): Promise<string | null> {
  return new Promise((resolve) => {
    let settled = false

    const dialog = new Dialog({
      title: options.title,
      width: options.width || "520px",
      content: `
        <div class="canvas-text-input-dialog">
          <input
            class="b3-text-field fn__block canvas-text-input-dialog__input"
            data-canvas-dialog-input
            value="${escapeHtml(options.initialValue)}"
          >
          <div class="canvas-text-input-dialog__actions">
            <button class="b3-button b3-button--outline" data-canvas-dialog-cancel type="button">${escapeHtml(options.cancelLabel)}</button>
            <button class="b3-button" data-canvas-dialog-confirm type="button">${escapeHtml(options.confirmLabel)}</button>
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

    const input = dialog.element.querySelector("[data-canvas-dialog-input]") as HTMLInputElement | null
    const cancelButton = dialog.element.querySelector("[data-canvas-dialog-cancel]") as HTMLButtonElement | null
    const confirmButton = dialog.element.querySelector("[data-canvas-dialog-confirm]") as HTMLButtonElement | null

    const close = (value: string | null) => {
      if (settled) {
        return
      }

      settled = true
      resolve(value)
      dialog.destroy()
    }

    cancelButton?.addEventListener("click", () => {
      close(null)
    })

    confirmButton?.addEventListener("click", () => {
      close(input?.value ?? "")
    })

    if (input) {
      dialog.bindInput(input, () => {
        confirmButton?.click()
      })

      queueMicrotask(() => {
        input.focus()
        input.select()
      })
    }
  })
}
