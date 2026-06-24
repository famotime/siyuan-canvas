import type { CanvasNode } from "@/canvas/types"

import {
  buildColorStyles,
  getColorThemeById,
  DEFAULT_COLOR_THEME,
} from "@/canvas/canvas-color-themes"

export const CLEAR_SELECTION_COLOR = ""

// Default theme color styles (backward compatible static export)
export const selectionColorStyles = buildColorStyles(getColorThemeById(DEFAULT_COLOR_THEME))

export const clearSelectionColorStyle = {
  border: 'var(--canvas-border, #cbd5e1)',
  swatch: 'var(--canvas-surface, #ffffff)',
  backgroundImage: 'linear-gradient(135deg, transparent 45%, #ef4444 45%, #ef4444 55%, transparent 55%)',
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

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "")
  if (normalized.length === 3) {
    const r = Number.parseInt(normalized[0] + normalized[0], 16)
    const g = Number.parseInt(normalized[1] + normalized[1], 16)
    const b = Number.parseInt(normalized[2] + normalized[2], 16)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }
  const r = Number.parseInt(normalized.slice(0, 2), 16)
  const g = Number.parseInt(normalized.slice(2, 4), 16)
  const b = Number.parseInt(normalized.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export function getSelectionColorStyle(
  color: string,
  colorStyles?: Record<string, { background: string, border: string, swatch: string }>,
) {
  const styles = colorStyles ?? selectionColorStyles

  if (!color) {
    return {
      backgroundColor: clearSelectionColorStyle.swatch,
      backgroundImage: clearSelectionColorStyle.backgroundImage,
      borderColor: clearSelectionColorStyle.border,
    }
  }

  let colorStyle = styles[color]
  if (!colorStyle && color && color.startsWith("#")) {
    colorStyle = {
      background: hexToRgba(color, 0.18),
      border: color,
      swatch: color,
    }
  }

  return {
    backgroundColor: colorStyle?.swatch || "#64748b",
    borderColor: colorStyle?.border || "#64748b",
  }
}

export function getCanvasNodeStyle(
  node: CanvasNode,
  baseStyle: Record<string, string>,
  options: {
    presentationMaskActive?: boolean
    selected?: boolean
    themeMode?: "dark" | "light"
  } = {},
  colorStyles?: Record<string, { background: string, border: string, swatch: string }>,
) {
  const styles = colorStyles ?? selectionColorStyles
  let colorStyle = "color" in node && node.color ? styles[node.color] : undefined
  if (!colorStyle && "color" in node && node.color && node.color.startsWith("#")) {
    colorStyle = {
      background: hexToRgba(node.color, 0.18),
      border: node.color,
      swatch: node.color,
    }
  }
  const zIndex = node.type === "group"
    ? options.selected ? "2" : "1"
    : options.selected ? "4" : "3"

  return {
    ...baseStyle,
    zIndex,
    ...(colorStyle ? {
      ...(options.presentationMaskActive && options.themeMode !== "dark"
        ? { background: `linear-gradient(${colorStyle.background}, ${colorStyle.background}), #fff` }
        : { backgroundColor: colorStyle.background }),
      borderColor: colorStyle.border,
    } : {}),
  }
}

export function getCanvasNodeContentStyle(
  node: CanvasNode,
  colorStyles?: Record<string, { background: string, border: string, swatch: string }>,
) {
  if (node.type !== "group" || !node.color) {
    return undefined
  }

  const styles = colorStyles ?? selectionColorStyles
  let colorStyle = styles[node.color]
  if (!colorStyle && node.color && node.color.startsWith("#")) {
    colorStyle = {
      background: hexToRgba(node.color, 0.18),
      border: node.color,
      swatch: node.color,
    }
  }

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
