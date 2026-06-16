export type CanvasColorThemeId = "classic" | "cool-rainbow" | "earth" | "neon"

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
    id: "cool-rainbow",
    nameKey: "colorThemeCoolRainbow",
    colors: {
      "1": "#10b981",
      "2": "#0ea5e9",
      "3": "#2563eb",
      "4": "#7c3aed",
      "5": "#4f46e5",
      "6": "#059669",
    },
  },
  {
    id: "earth",
    nameKey: "colorThemeEarth",
    colors: {
      "1": "#c77a3a",
      "2": "#4a6b53",
      "3": "#8c6239",
      "4": "#5b7a9c",
      "5": "#a88d5e",
      "6": "#7c587f",
    },
  },
  {
    id: "neon",
    nameKey: "colorThemeNeon",
    colors: {
      "1": "#00f0ff",
      "2": "#bd00ff",
      "3": "#ff2a85",
      "4": "#ff9900",
      "5": "#ccff00",
      "6": "#00ff66",
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
