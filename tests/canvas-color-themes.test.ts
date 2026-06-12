import { describe, expect, it } from "vitest"
import {
  buildColorStyles,
  CANVAS_COLOR_THEMES,
  DEFAULT_COLOR_THEME,
  getColorThemeById,
  type CanvasColorThemeId,
} from "@/canvas/canvas-color-themes"

describe("canvas color themes", () => {
  it("defines 4 themes each with 6 color slots", () => {
    expect(CANVAS_COLOR_THEMES).toHaveLength(4)
    for (const theme of CANVAS_COLOR_THEMES) {
      expect(theme.colors).toHaveProperty("1")
      expect(theme.colors).toHaveProperty("2")
      expect(theme.colors).toHaveProperty("3")
      expect(theme.colors).toHaveProperty("4")
      expect(theme.colors).toHaveProperty("5")
      expect(theme.colors).toHaveProperty("6")
    }
  })

  it("classic theme matches the original default colors", () => {
    const classic = getColorThemeById("classic")
    expect(classic.colors["1"]).toBe("#ef4444")
    expect(classic.colors["2"]).toBe("#f97316")
    expect(classic.colors["3"]).toBe("#f4b400")
    expect(classic.colors["4"]).toBe("#22c55e")
    expect(classic.colors["5"]).toBe("#4dd0e1")
    expect(classic.colors["6"]).toBe("#8b5cf6")
  })

  it("getColorThemeById falls back to default for unknown ids", () => {
    const theme = getColorThemeById("nonexistent" as CanvasColorThemeId)
    expect(theme.id).toBe(DEFAULT_COLOR_THEME)
  })

  it("buildColorStyles produces background/border/swatch for all 6 slots", () => {
    const theme = getColorThemeById("classic")
    const styles = buildColorStyles(theme)
    expect(styles["1"]).toEqual({
      background: "rgba(239, 68, 68, 0.18)",
      border: "#ef4444",
      swatch: "#ef4444",
    })
    expect(styles["5"]).toEqual({
      background: "rgba(77, 208, 225, 0.18)",
      border: "#4dd0e1",
      swatch: "#4dd0e1",
    })
  })

  it("buildColorStyles derives 18% opacity background from hex", () => {
    const theme = getColorThemeById("cool-warm")
    const styles = buildColorStyles(theme)
    // cool-warm slot 1 is #3b82f6 → rgba(59, 130, 246, 0.18)
    expect(styles["1"].background).toBe("rgba(59, 130, 246, 0.18)")
    expect(styles["1"].border).toBe("#3b82f6")
    expect(styles["1"].swatch).toBe("#3b82f6")
  })

  it("all themes have 6 distinct colors (no duplicate border values within a theme)", () => {
    for (const theme of CANVAS_COLOR_THEMES) {
      const borders = Object.values(theme.colors)
      const unique = new Set(borders)
      expect(unique.size).toBe(6)
    }
  })

  it("default theme is classic", () => {
    expect(DEFAULT_COLOR_THEME).toBe("classic")
  })
})
