# Canvas 颜色主题系统设计

日期：2026-06-13

## 概述

在顶部工具栏增加颜色主题按钮，提供 4 套彩虹色系预设主题，用户可切换不同配色方案。切换后所有画布中的节点和边即时更新颜色显示。主题偏好全局持久化（插件 settings）。

## 设计目标

- 每套主题使用 6 个差异明显的彩虹色，覆盖色轮不同区域
- 不同主题的冷暖色顺序不同，提供视觉多样性
- 切换主题即时生效，无需重新加载
- 主题偏好全局持久化，跨文件共享

## 预设主题

| 槽位 | 经典彩虹 | 冷暖交织 | 暖调渐变 | 冷调渐变 |
|------|---------|---------|---------|---------|
| 1 | 红 `#ef4444` | 蓝 `#3b82f6` | 玫瑰红 `#e11d48` | 靛蓝 `#4f46e5` |
| 2 | 橙 `#f97316` | 绿 `#22c55e` | 橙 `#ea580c` | 翠绿 `#059669` |
| 3 | 黄 `#f4b400` | 橙 `#f97316` | 琥珀 `#d97706` | 黄绿 `#65a30d` |
| 4 | 绿 `#22c55e` | 红 `#ef4444` | 翠绿 `#059669` | 天蓝 `#0ea5e9` |
| 5 | 青 `#4dd0e1` | 紫 `#8b5cf6` | 钴蓝 `#2563eb` | 紫 `#7c3aed` |
| 6 | 紫 `#8b5cf6` | 青 `#06b6d4` | 紫 `#9333ea` | 品红 `#db2777` |

**默认主题：经典彩虹**（即当前配色方案）

## 数据结构

```typescript
// canvas-color-themes.ts（新文件）
export type CanvasColorThemeId = 'classic' | 'cool-warm' | 'warm' | 'cool'

export interface CanvasColorTheme {
  id: CanvasColorThemeId
  nameKey: string  // i18n 翻译键
  colors: Record<'1' | '2' | '3' | '4' | '5' | '6', string>  // 6 个 border hex 色值
}

export const CANVAS_COLOR_THEMES: CanvasColorTheme[] = [...]

export const DEFAULT_COLOR_THEME: CanvasColorThemeId = 'classic'
```

每个 border 色值自动派生：
- `background`：`rgba(r, g, b, 0.18)` — 节点填充色
- `border`：原始 hex — 节点边框、边线描边
- `swatch`：原始 hex — 颜色选择器色块

复用现有 `selectionColorStyles` 的格式和 `hexToRgba(hex, 0.18)` 计算逻辑。

## 持久化

在插件 settings 中新增字段：

```typescript
interface CanvasPluginSettings {
  // ...existing fields...
  colorTheme: CanvasColorThemeId  // 默认 'classic'
}
```

通过 `plugin.setting` 的 `addItem` 注册，或直接在内存中管理并在 `saveData`/`loadData` 生命周期中读写。

实际实现取决于现有 settings 机制——检查 `CanvasPluginBridge` 接口和 `use-canvas-editor.ts` 中 settings 的使用方式。

## 交互设计

### 顶部工具栏按钮

- 位置：View 组（zoom/reset）之后，`toolbar__meta` 之前
- 图标：复用现有 `color` 图标
- 点击打开 popover 下拉菜单

### Popover 菜单

```
┌─────────────────────────┐
│  ✓ 经典彩虹              │
│    ████████████████      │  ← 6 色预览条
│    冷暖交织              │
│    ████████████████      │
│    暖调渐变              │
│    ████████████████      │
│    冷调渐变              │
│    ████████████████      │
└─────────────────────────┘
```

- 每行：主题名称 + 6 色横条预览
- 当前选中项带 ✓ 标记
- 点击切换主题，popover 自动关闭
- 点击外部区域关闭

### Popover 实现模式

复用现有 popover 模式（`selection-toolbar__popover` 的 CSS 和交互方式），但适配为顶部工具栏上下文：
- 新增 `toolbar__theme-popover` CSS 类
- 状态用 `ref<boolean>` 控制开关
- 点击外部关闭：复用现有的 `pointerdown` 事件监听模式

## 实现变更

### 1. 新增文件

**`src/canvas/canvas-color-themes.ts`**
- 主题定义（4 套 × 6 色）
- `getColorThemeById(id)` 查找函数
- `buildColorStyles(theme)` 函数：从主题的 6 个 border hex 生成完整的 `selectionColorStyles` 格式
- `DEFAULT_COLOR_THEME` 常量

**`tests/canvas-color-themes.test.ts`**
- 测试主题查找
- 测试 `buildColorStyles` 生成正确的 background/border/swatch

### 2. 修改文件

**`src/components/canvas/canvas-workspace-display.ts`**
- 将静态 `selectionColorStyles` 改为接受主题参数的函数：`buildSelectionColorStyles(theme: CanvasColorTheme)`
- 保留 `CLEAR_SELECTION_COLOR` 不变（清除颜色不受主题影响）
- 导出保持向后兼容：提供默认主题的静态值

**`src/canvas/use-canvas-editor.ts`**
- 新增 `currentColorTheme` ref（从 settings 初始化）
- 新增 `selectionColorStyles` computed（基于当前主题）
- 暴露 `setColorTheme(themeId)` 方法

**`src/components/canvas/CanvasWorkspace.vue`**
- 顶部工具栏新增主题按钮（View 组之后）
- 新增主题 popover DOM
- 引入 `currentColorTheme` 和 `setColorTheme`
- 节点/边颜色渲染改用响应式的 `selectionColorStyles`

**`src/components/canvas/canvas-workspace.scss`**
- 新增 `.toolbar__theme-popover` 样式
- 主题菜单项样式（名称 + 色条预览 + 选中标记）

**`src/i18n/zh_CN/canvas.ts` 和 `src/i18n/en_US/canvas.ts`**
- 新增主题名称翻译键
- 新增 tooltip 文本

**`src/index.ts`（或 settings 相关文件）**
- 插件 settings 新增 `colorTheme` 字段
- `loadData`/`saveData` 中读写

### 3. 图标

复用现有 `color` 图标（`CANVAS_ICON_MARKUP` 中已有）。

## 不变量保护

- 节点/边存储的 `color` 字段值始终是 `"1"` ~ `"6"` 的编号字符串
- 主题切换只改变编号→实际色值的映射，不修改文档数据
- `CLEAR_SELECTION_COLOR`（`""`）不受主题影响
- JSON Canvas 兼容性不受影响

## 测试计划

- `canvas-color-themes.test.ts`：主题查找、颜色样式生成
- 手动测试：切换主题后节点/边颜色即时更新
- 持久化测试：切换主题后刷新页面，主题保持
- 边界情况：无颜色节点/边在主题切换后保持默认样式
