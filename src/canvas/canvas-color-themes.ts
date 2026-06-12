export type CanvasColorThemeId = "classic" | "cool-warm" | "warm" | "cool"

export interface CanvasColorTheme {
  id: CanvasColorThemeId
  nameKey: string
  colors: Record<"1" | "2" | "3" | "4" | "5" | "6", string>
}

export const DEFAULT_COLOR_THEME: CanvasColorThemeId = "classic"

export const CANVAS_COLOR_THEMES: CanvasColorTheme[] = [
  {
    id: "classic",
    nameKey: "colorThemeClassic",
    colors: {
      "1": "#ef4444",
      "2": "#f97316",
      "3": "#f4b400",
      "4": "#22c55e",
      "5": "#4dd0e1",
      "6": "#8b5cf6",
    },
  },
  {
    id: "cool-warm",
    nameKey: "colorThemeCoolWarm",
    colors: {
      "1": "#3b82f6",
      "2": "#22c55e",
      "3": "#f97316",
      "4": "#ef4444",
      "5": "#8b5cf6",
      "6": "#06b6d4",
    },
  },
  {
    id: "warm",
    nameKey: "colorThemeWarm",
    colors: {
      "1": "#e11d48",
      "2": "#ea580c",
      "3": "#d97706",
      "4": "#059669",
      "5": "#2563eb",
      "6": "#9333ea",
    },
  },
  {
    id: "cool",
    nameKey: "colorThemeCool",
    colors: {
      "1": "#4f46e5",
      "2": "#059669",
      "3": "#65a30d",
      "4": "#0ea5e9",
      "5": "#7c3aed",
      "6": "#db2777",
    },
  },
]

export function getColorThemeById(id: CanvasColorThemeId): CanvasColorTheme {
  return CANVAS_COLOR_THEMES.find(t => t.id === id)
    ?? CANVAS_COLOR_THEMES.find(t => t.id === DEFAULT_COLOR_THEME)!
}

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "")
  const r = Number.parseInt(normalized.slice(0, 2), 16)
  const g = Number.parseInt(normalized.slice(2, 4), 16)
  const b = Number.parseInt(normalized.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export function buildColorStyles(
  theme: CanvasColorTheme,
): Record<string, { background: string, border: string, swatch: string }> {
  const result: Record<string, { background: string, border: string, swatch: string }> = {}
  for (const [key, hex] of Object.entries(theme.colors)) {
    result[key] = {
      background: hexToRgba(hex, 0.18),
      border: hex,
      swatch: hex,
    }
  }
  return result
}
