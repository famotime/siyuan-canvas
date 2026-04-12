import { confirm } from "siyuan"

export function openConfirmDialog(title: string, text: string): Promise<boolean> {
  return new Promise((resolve) => {
    confirm(
      title,
      text,
      (dialog) => {
        dialog.destroy()
        resolve(true)
      },
      (dialog) => {
        dialog.destroy()
        resolve(false)
      },
    )
  })
}
