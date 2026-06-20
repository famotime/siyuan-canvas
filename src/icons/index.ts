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
export const CANVAS_TAB_ICON_BODY = '<g transform="translate(48,0) scale(-1,1)"><path d="M40 12C42.2091 12 44 10.2091 44 8C44 5.79086 42.2091 4 40 4C37.7909 4 36 5.79086 36 8C36 10.2091 37.7909 12 40 12Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M40 44C42.2091 44 44 42.2091 44 40C44 37.7909 42.2091 36 40 36C37.7909 36 36 37.7909 36 40C36 42.2091 37.7909 44 40 44Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M8 12C10.2091 12 12 10.2091 12 8C12 5.79086 10.2091 4 8 4C5.79086 4 4 5.79086 4 8C4 10.2091 5.79086 12 8 12Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M8 44C10.2091 44 12 42.2091 12 40C12 37.7909 10.2091 36 8 36C5.79086 36 4 37.7909 4 40C4 42.2091 5.79086 44 8 44Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M20 8H28" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path fill-rule="evenodd" clip-rule="evenodd" d="M32 16L16 32L32 16Z" fill="none"/><path d="M32 16L16 32" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M40 20V28" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></g>'

/** 思源 Dock 侧边栏图标 sprite ID */
export const CANVAS_DOCK_ICON_ID = 'iconCanvasDock'

/** 思源 Dock 侧边栏图标 sprite 体：文件夹 + 文档图形，通过 currentColor 继承 dock 按钮颜色 */
export const CANVAS_DOCK_ICON_BODY = '<path d="M8 10h10l3 4h15a2 2 0 012 2v16a2 2 0 01-2 2H8a2 2 0 01-2-2V12a2 2 0 012-2z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M22 22h10M22 28h10M22 34h6" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>'
