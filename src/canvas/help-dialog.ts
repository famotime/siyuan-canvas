import { Dialog } from "siyuan"

interface HelpShortcut {
  action: string
  key: string
}

export function openHelpDialog(title: string, shortcuts: HelpShortcut[]) {
  const rows = shortcuts
    .map(({ key, action }) => `<tr><td style="padding:4px 12px 4px 0;white-space:nowrap;font-weight:600;">${key}</td><td style="padding:4px 0;">${action}</td></tr>`)
    .join("")
  new Dialog({
    content: `<div style="max-height:60vh;overflow:auto;"><table style="width:100%;border-collapse:collapse;font-size:13px;">${rows}</table></div>`,
    title,
    width: "480px",
  })
}
