import type { CanvasNode } from "@/canvas/types"

export const CLEAR_SELECTION_COLOR = ""

export const selectionColorStyles: Record<string, { background: string, border: string, swatch: string }> = {
  "1": {
    background: "rgba(239, 68, 68, 0.18)",
    border: "#ef4444",
    swatch: "#ef4444",
  },
  "2": {
    background: "rgba(249, 115, 22, 0.18)",
    border: "#f97316",
    swatch: "#f97316",
  },
  "3": {
    background: "rgba(244, 180, 0, 0.18)",
    border: "#f4b400",
    swatch: "#f4b400",
  },
  "4": {
    background: "rgba(34, 197, 94, 0.18)",
    border: "#22c55e",
    swatch: "#22c55e",
  },
  "5": {
    background: "rgba(77, 208, 225, 0.18)",
    border: "#4dd0e1",
    swatch: "#4dd0e1",
  },
  "6": {
    background: "rgba(139, 92, 246, 0.18)",
    border: "#8b5cf6",
    swatch: "#8b5cf6",
  },
}

export const clearSelectionColorStyle = {
  border: "#94a3b8",
  swatch: "#9ca3af",
}

function getHexChannel(value: string): number {
  return Number.parseInt(value, 16)
}

function normalizeHexColor(value: string): string | null {
  const trimmed = value.trim()
  if (!/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(trimmed)) {
    return null
  }

  if (trimmed.length === 4) {
    return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`
  }

  return trimmed.toLowerCase()
}

function getContrastingLabelTextColor(background: string): string {
  const normalized = normalizeHexColor(background)
  if (!normalized) {
    return "#ffffff"
  }

  const red = getHexChannel(normalized.slice(1, 3))
  const green = getHexChannel(normalized.slice(3, 5))
  const blue = getHexChannel(normalized.slice(5, 7))
  const luminance = (red * 299 + green * 587 + blue * 114) / 1000

  return luminance >= 160 ? "#111827" : "#ffffff"
}

export function getSelectionColorStyle(color: string) {
  if (!color) {
    return {
      backgroundColor: clearSelectionColorStyle.swatch,
      borderColor: clearSelectionColorStyle.border,
    }
  }

  const colorStyle = selectionColorStyles[color]

  return {
    backgroundColor: colorStyle?.swatch || "#64748b",
    borderColor: colorStyle?.border || "#64748b",
  }
}

export function getCanvasNodeStyle(
  node: CanvasNode,
  baseStyle: Record<string, string>,
) {
  const colorStyle = "color" in node && node.color ? selectionColorStyles[node.color] : undefined

  return {
    ...baseStyle,
    ...(colorStyle ? {
      backgroundColor: colorStyle.background,
      borderColor: colorStyle.border,
    } : {}),
  }
}

export function getCanvasNodeContentStyle(node: CanvasNode) {
  if (node.type !== "group" || !node.color) {
    return undefined
  }

  const colorStyle = selectionColorStyles[node.color]

  if (!colorStyle) {
    return undefined
  }

  return {
    backgroundColor: colorStyle.border,
    color: getContrastingLabelTextColor(colorStyle.border),
  }
}

export function getNodeSelectionColorValue(node: CanvasNode) {
  return typeof node.color === "string" && node.color ? node.color : CLEAR_SELECTION_COLOR
}
