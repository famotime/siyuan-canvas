/**
 * 图标体系单一入口。
 *
 * 项目中三处需要图标 SVG：
 *  1. `<CanvasIcon name="..." />` Vue 组件 — 走 {@link getCanvasIconMarkup} 字典查表
 *  2. 思源顶栏 `addTopBar({ icon: '<svg>...</svg>' })` — 直接接收完整 SVG 字符串 → {@link TOPBAR_ICON_SVG}
 *  3. 思源 sprite `addIcons('<symbol id="X" viewBox="...">...</symbol>')` — 接收 `<symbol>` 体（不含 svg 包裹）→ {@link CANVAS_TAB_ICON_BODY}
 *
 * 这里集中收口，未来若迁移到 `vite-svg-loader`，调用方只需改 import 路径而非搜索散落各处的 SVG 字面量。
 */

export {
  CanvasIcon,
  getCanvasIconMarkup,
} from '@/components/canvas/canvas-icon'
export type { CanvasIconName } from '@/components/canvas/canvas-icon'

import { getCanvasIconMarkup } from '@/components/canvas/canvas-icon'

/** 思源顶栏图标，完整 `<svg>` 字符串 */
export const TOPBAR_ICON_SVG = getCanvasIconMarkup('topbar')

/** 思源 Tab 图标 sprite ID（addIcons 注册后用 `iconCanvasTab` 引用） */
export const CANVAS_TAB_ICON_ID = 'iconCanvasTab'

/**
 * 思源 Tab 图标 sprite 体：仅 `<symbol id="iconCanvasTab" viewBox="0 0 48 48">…</symbol>` 内部内容。
 * 与 topbar 图标共用同一图形（铅笔 + 横线），但通过 currentColor 继承 tab 的高亮态颜色。
 */
export const CANVAS_TAB_ICON_BODY = '<path fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" d="M24 24V19L39 4L44 9L29 24H24Z"/><path stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none" d="M16 24H9C6.23858 24 4 26.2386 4 29C4 31.7614 6.23858 34 9 34H39C41.7614 34 44 36.2386 44 39C44 41.7614 41.7614 44 39 44H18"/>'
