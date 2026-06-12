# Canvas 颜色主题系统实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在顶部工具栏添加颜色主题切换按钮，提供 4 套彩虹色系预设主题，全局持久化主题偏好。

**Architecture:** 新增 `canvas-color-themes.ts` 定义 4 套主题，每套 6 色。`canvas-workspace-display.ts` 的颜色查表改为接受主题参数。`use-canvas-editor.ts` 管理响应式 `currentColorTheme`，通过 `CanvasPluginBridge.updateCanvasSettings()` 持久化到插件 settings。`CanvasWorkspace.vue` 顶部工具栏增加主题按钮 + popover 菜单。

**Tech Stack:** Vue 3 Composition API, TypeScript, SCSS, Vitest

---

### Task 1: 创建颜色主题定义模块

**Files:**
- Create: `src/canvas/canvas-color-themes.ts`
- Test: `tests/canvas-color-themes.test.ts`

- [ ] **Step 1: 写失败测试**

```typescript
// tests/canvas-color-themes.test.ts
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
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test -- tests/canvas-color-themes.test.ts`
Expected: FAIL — module `@/canvas/canvas-color-themes` not found

- [ ] **Step 3: 实现主题定义模块**

```typescript
// src/canvas/canvas-color-themes.ts

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
  return CANVAS_COLOR_THEMES.find((t) => t.id === id)
    ?? CANVAS_COLOR_THEMES.find((t) => t.id === DEFAULT_COLOR_THEME)!
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
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm test -- tests/canvas-color-themes.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/canvas/canvas-color-themes.ts tests/canvas-color-themes.test.ts
git commit -m "feat: 添加颜色主题定义模块（4 套彩虹色系预设）"
```

---

### Task 2: 添加 i18n 翻译键

**Files:**
- Modify: `src/i18n/zh_CN.json`
- Modify: `src/i18n/en_US.json`

- [ ] **Step 1: 写失败测试**

在 `tests/canvas-i18n.test.ts` 中追加测试（如果已有测试结构则追加，否则新建）：

```typescript
// 追加到现有测试文件或新建
import { describe, expect, it } from "vitest"
import zhCN from "@/i18n/zh_CN.json"
import enUS from "@/i18n/en_US.json"

describe("color theme i18n keys", () => {
  it("zh_CN has all color theme keys", () => {
    expect(zhCN.colorThemeClassic).toBeDefined()
    expect(zhCN.colorThemeCoolWarm).toBeDefined()
    expect(zhCN.colorThemeWarm).toBeDefined()
    expect(zhCN.colorThemeCool).toBeDefined()
    expect(zhCN.toolbarColorTheme).toBeDefined()
  })

  it("en_US has all color theme keys", () => {
    expect(enUS.colorThemeClassic).toBeDefined()
    expect(enUS.colorThemeCoolWarm).toBeDefined()
    expect(enUS.colorThemeWarm).toBeDefined()
    expect(enUS.colorThemeCool).toBeDefined()
    expect(enUS.toolbarColorTheme).toBeDefined()
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test -- tests/canvas-i18n.test.ts`
Expected: FAIL — `colorThemeClassic` not defined

- [ ] **Step 3: 添加 zh_CN 翻译**

在 `src/i18n/zh_CN.json` 末尾的 `}` 之前添加：

```json
  "toolbarColorTheme": "颜色主题",
  "colorThemeClassic": "经典彩虹",
  "colorThemeCoolWarm": "冷暖交织",
  "colorThemeWarm": "暖调渐变",
  "colorThemeCool": "冷调渐变"
```

- [ ] **Step 4: 添加 en_US 翻译**

在 `src/i18n/en_US.json` 末尾的 `}` 之前添加：

```json
  "toolbarColorTheme": "Color Theme",
  "colorThemeClassic": "Classic Rainbow",
  "colorThemeCoolWarm": "Cool-Warm Mix",
  "colorThemeWarm": "Warm Gradient",
  "colorThemeCool": "Cool Gradient"
```

- [ ] **Step 5: 运行测试确认通过**

Run: `pnpm test -- tests/canvas-i18n.test.ts`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add src/i18n/zh_CN.json src/i18n/en_US.json
git commit -m "feat: 添加颜色主题 i18n 翻译键"
```

---

### Task 3: 扩展插件 Settings 和 Bridge 接口

**Files:**
- Modify: `src/canvas/plugin-data.ts`
- Modify: `src/canvas/use-canvas-editor-shared.ts`
- Modify: `src/index.ts`
- Test: `tests/canvas-plugin-data.test.ts`

- [ ] **Step 1: 写失败测试**

```typescript
// 追加到 tests/canvas-plugin-data.test.ts
import { describe, expect, it } from "vitest"
import {
  createDefaultCanvasPluginSettings,
  normalizeCanvasPluginData,
} from "@/canvas/plugin-data"

describe("colorTheme in plugin settings", () => {
  it("default settings include colorTheme as classic", () => {
    const settings = createDefaultCanvasPluginSettings()
    expect(settings.colorTheme).toBe("classic")
  })

  it("normalizes valid colorTheme", () => {
    const data = normalizeCanvasPluginData({
      version: 1,
      settings: { colorTheme: "warm" },
    })
    expect(data.settings.colorTheme).toBe("warm")
  })

  it("falls back to classic for invalid colorTheme", () => {
    const data = normalizeCanvasPluginData({
      version: 1,
      settings: { colorTheme: "invalid" },
    })
    expect(data.settings.colorTheme).toBe("classic")
  })

  it("falls back to classic when colorTheme is missing", () => {
    const data = normalizeCanvasPluginData({
      version: 1,
      settings: {},
    })
    expect(data.settings.colorTheme).toBe("classic")
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test -- tests/canvas-plugin-data.test.ts`
Expected: FAIL — `colorTheme` property does not exist

- [ ] **Step 3: 扩展 CanvasPluginSettings 接口**

在 `src/canvas/plugin-data.ts` 中：

1. 在文件顶部添加导入：

```typescript
import type { CanvasColorThemeId } from "@/canvas/canvas-color-themes"
import { DEFAULT_COLOR_THEME } from "@/canvas/canvas-color-themes"
```

2. 在 `CanvasPluginSettings` 接口中添加字段：

```typescript
export interface CanvasPluginSettings {
  colorTheme: CanvasColorThemeId  // 新增
  defaultCanvasDirectory: string
  detectExternalChanges: boolean
  enableDebugLog: boolean
  recentFilesLimit: number
  noteCreationDirectory: string
  showCanvasThumbnails: boolean
}
```

3. 在 `createDefaultCanvasPluginSettings()` 中添加默认值：

```typescript
export function createDefaultCanvasPluginSettings(): CanvasPluginSettings {
  return {
    colorTheme: DEFAULT_COLOR_THEME,  // 新增
    defaultCanvasDirectory: CANVAS_DEFAULT_DIRECTORY,
    // ...existing...
  }
}
```

4. 在 `normalizeCanvasPluginData` 的 settings 合并逻辑中添加：

```typescript
const VALID_COLOR_THEMES: CanvasColorThemeId[] = ["classic", "cool-warm", "warm", "cool"]

const settings = {
  colorTheme: (VALID_COLOR_THEMES as string[]).includes(candidate.settings?.colorTheme)
    ? candidate.settings!.colorTheme as CanvasColorThemeId
    : defaults.settings.colorTheme,
  // ...existing fields...
}
```

- [ ] **Step 4: 扩展 CanvasPluginBridge 接口**

在 `src/canvas/use-canvas-editor-shared.ts` 的 `CanvasPluginBridge` 接口中添加：

```typescript
export interface CanvasPluginBridge extends Plugin {
  // ...existing...
  updateCanvasSettings?: (settings: Partial<CanvasPluginSettings>) => Promise<void>
}
```

注意：`updateCanvasSettings` 已经在 `SiyuanCanvasPlugin` 类上实现（`index.ts:212`），只是 bridge 接口未声明。此处仅添加类型声明。

- [ ] **Step 5: 运行测试确认通过**

Run: `pnpm test -- tests/canvas-plugin-data.test.ts`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add src/canvas/plugin-data.ts src/canvas/use-canvas-editor-shared.ts
git commit -m "feat: 在插件 settings 和 bridge 接口中添加 colorTheme 字段"
```

---

### Task 4: 让 canvas-workspace-display 支持主题化查表

**Files:**
- Modify: `src/components/canvas/canvas-workspace-display.ts`
- Modify: `tests/canvas-workspace-display.test.ts`

- [ ] **Step 1: 写失败测试**

在 `tests/canvas-workspace-display.test.ts` 中追加：

```typescript
import {
  getColorThemeById,
  buildColorStyles,
} from "@/canvas/canvas-color-themes"
import {
  clearSelectionColorStyle,
  getCanvasNodeContentStyle,
  getCanvasNodeStyle,
  getSelectionColorStyle,
} from "@/components/canvas/canvas-workspace-display"

describe("theme-aware color styles", () => {
  it("getSelectionColorStyle uses default theme colors", () => {
    // slot 1 in classic = #ef4444
    const style = getSelectionColorStyle("1")
    expect(style.backgroundColor).toBe("rgba(239, 68, 68, 0.18)")
    expect(style.borderColor).toBe("#ef4444")
  })

  it("getCanvasNodeStyle uses provided colorStyles", () => {
    const warmTheme = getColorThemeById("warm")
    const warmStyles = buildColorStyles(warmTheme)
    const result = getCanvasNodeStyle(
      { color: "1", height: 100, id: "n1", text: "x", type: "text", width: 200, x: 0, y: 0 },
      { height: "100px", left: "0px", top: "0px", width: "200px" },
      {},
      warmStyles,
    )
    // warm slot 1 = #e11d48
    expect(result.backgroundColor).toBe("rgba(225, 29, 72, 0.18)")
    expect(result.borderColor).toBe("#e11d48")
  })

  it("getCanvasNodeContentStyle uses provided colorStyles", () => {
    const coolTheme = getColorThemeById("cool")
    const coolStyles = buildColorStyles(coolTheme)
    const result = getCanvasNodeContentStyle(
      { color: "1", height: 200, id: "g1", label: "G", type: "group", width: 400, x: 0, y: 0 },
      coolStyles,
    )
    // cool slot 1 = #4f46e5
    expect(result?.backgroundColor).toBe("#4f46e5")
  })

  it("getCanvasNodeStyle falls back to default styles when no colorStyles provided", () => {
    // 向后兼容：不传 colorStyles 时使用默认主题
    const result = getCanvasNodeStyle(
      { color: "2", height: 100, id: "n1", text: "x", type: "text", width: 200, x: 0, y: 0 },
      { height: "100px", left: "0px", top: "0px", width: "200px" },
    )
    expect(result.backgroundColor).toBe("rgba(249, 115, 22, 0.18)")
    expect(result.borderColor).toBe("#f97316")
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test -- tests/canvas-workspace-display.test.ts`
Expected: FAIL — `getCanvasNodeStyle` signature does not accept `colorStyles` parameter

- [ ] **Step 3: 重构 canvas-workspace-display.ts**

将 `canvas-workspace-display.ts` 重构为支持主题化：

```typescript
// src/components/canvas/canvas-workspace-display.ts
import type { CanvasNode } from "@/canvas/types"
import type { CanvasColorTheme } from "@/canvas/canvas-color-themes"

import {
  buildColorStyles,
  getColorThemeById,
  DEFAULT_COLOR_THEME,
} from "@/canvas/canvas-color-themes"

export const CLEAR_SELECTION_COLOR = ""

// 默认主题的颜色样式（向后兼容）
export const selectionColorStyles = buildColorStyles(getColorThemeById(DEFAULT_COLOR_THEME))

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

export function getSelectionColorStyle(
  color: string,
  colorStyles?: Record<string, { background: string, border: string, swatch: string }>,
) {
  const styles = colorStyles ?? selectionColorStyles

  if (!color) {
    return {
      backgroundColor: clearSelectionColorStyle.swatch,
      borderColor: clearSelectionColorStyle.border,
    }
  }

  const colorStyle = styles[color]

  return {
    backgroundColor: colorStyle?.swatch || "#64748b",
    borderColor: colorStyle?.border || "#64748b",
  }
}

export function getCanvasNodeStyle(
  node: CanvasNode,
  baseStyle: Record<string, string>,
  options: {
    selected?: boolean
  } = {},
  colorStyles?: Record<string, { background: string, border: string, swatch: string }>,
) {
  const styles = colorStyles ?? selectionColorStyles
  const colorStyle = "color" in node && node.color ? styles[node.color] : undefined
  const zIndex = node.type === "group"
    ? options.selected ? "2" : "1"
    : options.selected ? "4" : "3"

  return {
    ...baseStyle,
    zIndex,
    ...(colorStyle ? {
      backgroundColor: colorStyle.background,
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
  const colorStyle = styles[node.color]

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
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm test -- tests/canvas-workspace-display.test.ts`
Expected: PASS（现有测试仍然通过，因为新参数是可选的且有默认值）

- [ ] **Step 5: 提交**

```bash
git add src/components/canvas/canvas-workspace-display.ts tests/canvas-workspace-display.test.ts
git commit -m "feat: 让 canvas-workspace-display 颜色查表支持可选主题参数"
```

---

### Task 5: 在 use-canvas-editor 中管理主题状态

**Files:**
- Modify: `src/canvas/use-canvas-editor.ts`

- [ ] **Step 1: 添加主题相关状态和方法**

在 `src/canvas/use-canvas-editor.ts` 中：

1. 在文件顶部添加导入（约第 19 行附近，与现有导入合并）：

```typescript
import type { CanvasColorThemeId } from "@/canvas/canvas-color-themes"
import {
  buildColorStyles,
  CANVAS_COLOR_THEMES,
  getColorThemeById,
} from "@/canvas/canvas-color-themes"
```

2. 在 `useCanvasEditor` 函数体内部，约第 150 行（`recentFiles` 之后）添加：

```typescript
const colorThemeId = ref<CanvasColorThemeId>(
  getPluginSettings().colorTheme ?? "classic",
)
const currentColorStyles = computed(() =>
  buildColorStyles(getColorThemeById(colorThemeId.value)),
)
```

3. 添加主题切换函数（约在 `refreshRecentFiles` 函数附近）：

```typescript
async function setColorTheme(themeId: CanvasColorThemeId) {
  colorThemeId.value = themeId
  await plugin.updateCanvasSettings?.({ colorTheme: themeId })
}
```

4. 监听外部 settings 变更，保持主题同步（在 `onMounted` 附近或已有的 settings 监听处）：

```typescript
function handleExternalSettingsChange() {
  const settings = getPluginSettings()
  if (settings.colorTheme && settings.colorTheme !== colorThemeId.value) {
    colorThemeId.value = settings.colorTheme
  }
}
```

在 `onMounted` 中注册监听：

```typescript
window.addEventListener("siyuan-canvas-settings-changed", handleExternalSettingsChange)
```

在 `onBeforeUnmount` 中移除：

```typescript
window.removeEventListener("siyuan-canvas-settings-changed", handleExternalSettingsChange)
```

5. 在 return 对象中暴露（约第 1412 行）：

```typescript
colorThemeId,
colorThemes: CANVAS_COLOR_THEMES,
currentColorStyles,
setColorTheme,
```

- [ ] **Step 2: 运行全量测试确认无破坏**

Run: `pnpm test`
Expected: PASS

- [ ] **Step 3: 提交**

```bash
git add src/canvas/use-canvas-editor.ts
git commit -m "feat: 在编辑器 composable 中管理颜色主题状态"
```

---

### Task 6: 在 CanvasWorkspace 中添加主题按钮和 popover

**Files:**
- Modify: `src/components/canvas/CanvasWorkspace.vue`

- [ ] **Step 1: 添加主题 popover 状态变量**

在 `CanvasWorkspace.vue` 的 `<script setup>` 部分，约第 1672 行（`sortDropdownOpen` 附近）添加：

```typescript
const colorThemePopoverOpen = ref(false)
```

- [ ] **Step 2: 添加点击外部关闭逻辑**

查找现有的点击外部关闭逻辑（`sortDropdownOpen` 相关），在同一位置添加：

```typescript
function closeColorThemePopover(event: PointerEvent) {
  const target = event.target as HTMLElement
  if (!target.closest("[data-testid=\"toolbar-color-theme-popover\"]")
    && !target.closest("[data-testid=\"top-toolbar-color-theme\"]")) {
    colorThemePopoverOpen.value = false
  }
}
```

在 `onMounted` 中注册：

```typescript
document.addEventListener("pointerdown", closeColorThemePopover)
```

在 `onBeforeUnmount` 中移除：

```typescript
document.removeEventListener("pointerdown", closeColorThemePopover)
```

- [ ] **Step 3: 添加工具栏按钮和 popover HTML**

在 `CanvasWorkspace.vue` 的 `<template>` 中，在 View 组（`toolbarGroupView`）的 `</div>` 之后、`<div class="toolbar__meta">` 之前，添加：

```html
<span class="toolbar__divider" aria-hidden="true" />
<div class="toolbar__group">
  <div class="toolbar__theme-menu">
    <button
      class="toolbar__button toolbar__button--icon"
      :class="{ 'toolbar__button--active': colorThemePopoverOpen }"
      data-testid="top-toolbar-color-theme"
      :aria-label="t('toolbarColorTheme')"
      :data-tooltip="t('toolbarColorTheme')"
      :title="t('toolbarColorTheme')"
      type="button"
      @click="colorThemePopoverOpen = !colorThemePopoverOpen"
    >
      <CanvasIcon
        class="toolbar__icon"
        name="color"
      />
    </button>
    <div
      v-if="colorThemePopoverOpen"
      class="toolbar__theme-popover"
      data-testid="toolbar-color-theme-popover"
      @pointerdown.stop
    >
      <button
        v-for="theme in editor.colorThemes"
        :key="theme.id"
        class="toolbar__theme-option"
        :class="{ 'toolbar__theme-option--active': editor.colorThemeId === theme.id }"
        :data-testid="`color-theme-${theme.id}`"
        type="button"
        @click="editor.setColorTheme(theme.id); colorThemePopoverOpen = false"
      >
        <span class="toolbar__theme-check" aria-hidden="true">
          {{ editor.colorThemeId === theme.id ? "✓" : "" }}
        </span>
        <span class="toolbar__theme-name">{{ t(theme.nameKey) }}</span>
        <span class="toolbar__theme-preview" aria-hidden="true">
          <span
            v-for="colorKey in ['1','2','3','4','5','6'] as const"
            :key="colorKey"
            class="toolbar__theme-dot"
            :style="{ backgroundColor: theme.colors[colorKey] }"
          />
        </span>
      </button>
    </div>
  </div>
</div>
```

- [ ] **Step 4: 更新颜色相关函数调用以使用响应式颜色样式**

在 `CanvasWorkspace.vue` 中，更新以下导入（约第 1611 行）——将 `selectionColorStyles` 的直接引用改为使用 `editor.currentColorStyles`：

将现有的颜色相关使用：
- `selectionColorStyles` → `editor.currentColorStyles`
- `getSelectionColorStyle(color)` → `getSelectionColorStyle(color, editor.currentColorStyles)`
- `buildCanvasNodeStyle(...)` → 传入 `editor.currentColorStyles`
- `resolveCanvasNodeContentStyle(...)` → 传入 `editor.currentColorStyles`
- `getEdgeStrokeStyle(edge)` → 使用 `editor.currentColorStyles`
- `getEdgeLabelStyle(edge)` → 使用 `editor.currentColorStyles`

具体来说：

1. 模板中的 `getSelectionColorStyle(color)` 调用改为 `getSelectionColorStyle(color, editor.currentColorStyles)`

2. `getEdgeStrokeStyle` 函数（约第 2184 行）：

```typescript
function getEdgeStrokeStyle(edge: CanvasEdge) {
  const colorStyle = edge.color ? editor.currentColorStyles[edge.color] : undefined
  return colorStyle ? { color: colorStyle.border, stroke: colorStyle.border } : undefined
}
```

3. `getEdgeLabelStyle` 函数（约第 2189 行）：

```typescript
function getEdgeLabelStyle(edge: CanvasEdge) {
  const colorStyle = edge.color ? editor.currentColorStyles[edge.color] : undefined
  return colorStyle ? { fill: colorStyle.border } : undefined
}
```

4. `buildCanvasNodeStyle` 调用处（搜索所有 `buildCanvasNodeStyle` 调用），添加第 4 个参数 `editor.currentColorStyles`

5. `resolveCanvasNodeContentStyle` 调用处，添加第 2 个参数 `editor.currentColorStyles`

- [ ] **Step 5: 运行全量测试**

Run: `pnpm test`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add src/components/canvas/CanvasWorkspace.vue
git commit -m "feat: 在顶部工具栏添加颜色主题按钮和下拉菜单"
```

---

### Task 7: 添加主题菜单样式

**Files:**
- Modify: `src/components/canvas/canvas-workspace.scss`

- [ ] **Step 1: 添加主题 popover 样式**

在 `canvas-workspace.scss` 的工具栏相关样式区域末尾追加：

```scss
// 颜色主题下拉菜单
.toolbar__theme-menu {
  position: relative;
}

.toolbar__theme-popover {
  position: absolute;
  top: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  min-width: 220px;
  padding: 4px;
  border-radius: 8px;
  background: var(--canvas-floating-bg, var(--b3-theme-surface));
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.16);
  border: 1px solid var(--canvas-floating-border, var(--b3-border-color));
}

.toolbar__theme-option {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 10px;
  border: none;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  font-size: 13px;
  color: var(--b3-theme-on-surface);
  text-align: left;
  white-space: nowrap;

  &:hover {
    background: var(--canvas-floating-hover, var(--b3-list-hover));
  }

  &--active {
    font-weight: 600;
  }
}

.toolbar__theme-check {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  font-size: 13px;
  color: var(--b3-theme-primary);
  flex-shrink: 0;
}

.toolbar__theme-name {
  flex: 1;
  min-width: 0;
}

.toolbar__theme-preview {
  display: inline-flex;
  gap: 3px;
  flex-shrink: 0;
}

.toolbar__theme-dot {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 1px solid rgba(0, 0, 0, 0.1);
}
```

- [ ] **Step 2: 运行构建确认无 SCSS 语法错误**

Run: `pnpm build`
Expected: 成功，无 SCSS 编译错误

- [ ] **Step 3: 提交**

```bash
git add src/components/canvas/canvas-workspace.scss
git commit -m "feat: 添加颜色主题下拉菜单样式"
```

---

### Task 8: 在设置面板中添加颜色主题选项

**Files:**
- Modify: `src/canvas/plugin-settings-panel.ts`
- Modify: `src/i18n/zh_CN.json`
- Modify: `src/i18n/en_US.json`

- [ ] **Step 1: 添加设置面板 i18n 键**

在 `src/i18n/zh_CN.json` 的 settings 区域添加：

```json
  "settingsColorThemeTitle": "颜色主题",
  "settingsColorThemeDescription": "选择画布节点和连线的默认颜色方案。"
```

在 `src/i18n/en_US.json` 的 settings 区域添加：

```json
  "settingsColorThemeTitle": "Color Theme",
  "settingsColorThemeDescription": "Choose the default color scheme for canvas nodes and edges."
```

- [ ] **Step 2: 在设置面板中添加颜色主题选择器**

在 `src/canvas/plugin-settings-panel.ts` 中：

1. 添加导入：

```typescript
import type { CanvasColorThemeId } from "@/canvas/canvas-color-themes"
import { CANVAS_COLOR_THEMES } from "@/canvas/canvas-color-themes"
```

2. 在 `setting.addItem` 调用链中，第一个（`settingsDefaultCanvasDirectoryTitle`）之前添加：

```typescript
setting.addItem({
  title: t("settingsColorThemeTitle"),
  description: t("settingsColorThemeDescription"),
  createActionElement: () => {
    const select = document.createElement("select")
    select.className = "b3-select fn__flex-center"
    for (const theme of CANVAS_COLOR_THEMES) {
      const option = document.createElement("option")
      option.value = theme.id
      option.textContent = t(theme.nameKey as any)
      if (theme.id === draft.colorTheme) {
        option.selected = true
      }
      select.appendChild(option)
    }
    select.addEventListener("change", () => {
      draft.colorTheme = select.value as CanvasColorThemeId
      void saveDraft()
    })
    return select
  },
})
```

- [ ] **Step 3: 运行全量测试**

Run: `pnpm test`
Expected: PASS

- [ ] **Step 4: 提交**

```bash
git add src/canvas/plugin-settings-panel.ts src/i18n/zh_CN.json src/i18n/en_US.json
git commit -m "feat: 在插件设置面板中添加颜色主题选择器"
```

---

### Task 9: 端到端验证和清理

- [ ] **Step 1: 运行全量测试**

Run: `pnpm test`
Expected: PASS

- [ ] **Step 2: 运行构建**

Run: `pnpm build`
Expected: 成功，无错误

- [ ] **Step 3: 检查 ESLint**

Run: `npx eslint src/canvas/canvas-color-themes.ts src/canvas/plugin-data.ts src/canvas/use-canvas-editor-shared.ts src/canvas/use-canvas-editor.ts src/components/canvas/canvas-workspace-display.ts src/components/canvas/CanvasWorkspace.vue src/canvas/plugin-settings-panel.ts`
Expected: 无错误（可能有格式警告，按项目规范修复）

- [ ] **Step 4: 提交最终清理**

```bash
git add -A
git commit -m "feat: 颜色主题系统完整实现（4 套彩虹色系预设 + 工具栏切换 + 全局持久化）"
```
