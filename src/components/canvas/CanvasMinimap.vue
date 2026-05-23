<template>
  <div
    v-if="totalNodes > 0"
    class="canvas-minimap"
    data-testid="canvas-minimap"
    @pointerdown.stop="onPointerDown"
  >
    <svg
      class="canvas-minimap__svg"
      :viewBox="`0 0 ${MINIMAP_WIDTH} ${MINIMAP_HEIGHT}`"
      :width="MINIMAP_WIDTH"
      :height="MINIMAP_HEIGHT"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      <rect
        class="canvas-minimap__bg"
        :x="0"
        :y="0"
        :width="MINIMAP_WIDTH"
        :height="MINIMAP_HEIGHT"
      />
      <rect
        v-for="node in editor.state.document.nodes"
        :key="`mini-${node.id}`"
        class="canvas-minimap__node"
        :class="{ 'canvas-minimap__node--selected': editor.state.selectedNodeIds.includes(node.id) }"
        :x="(node.x - minimapBounds.left) * scale + offsetX"
        :y="(node.y - minimapBounds.top) * scale + offsetY"
        :width="Math.max(2, node.width * scale)"
        :height="Math.max(2, node.height * scale)"
        :rx="1.5"
      />
      <rect
        v-if="viewportRect"
        class="canvas-minimap__viewport"
        :x="viewportRect.x"
        :y="viewportRect.y"
        :width="viewportRect.width"
        :height="viewportRect.height"
      />
    </svg>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue"
import type { CanvasNode } from "@/canvas/types"
import type { CanvasEditorState } from "@/canvas/editor-state"

const MINIMAP_WIDTH = 180
const MINIMAP_HEIGHT = 120
const PADDING = 4
const NODE_PADDING = 120

interface MinimapEditor {
  state: CanvasEditorState
  viewport: { scale: number, x: number, y: number }
  stageRef: { value?: HTMLElement } | HTMLElement | undefined
}

const props = defineProps<{ editor: MinimapEditor }>()

const totalNodes = computed(() => props.editor.state.document.nodes.length)

const stageSize = ref({ width: 1200, height: 800 })

function syncStageSize() {
  const stage = (props.editor.stageRef as { value?: HTMLElement } | undefined)?.value
    ?? (props.editor.stageRef as HTMLElement | undefined)
  if (!stage) return
  const rect = stage.getBoundingClientRect()
  if (rect.width > 0 && rect.height > 0) {
    stageSize.value = { width: rect.width, height: rect.height }
  }
}

let resizeObserver: ResizeObserver | undefined
watch(
  () => (props.editor.stageRef as { value?: HTMLElement } | undefined)?.value,
  (stage) => {
    resizeObserver?.disconnect()
    if (!stage || typeof ResizeObserver === "undefined") return
    syncStageSize()
    resizeObserver = new ResizeObserver(syncStageSize)
    resizeObserver.observe(stage)
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
})

/**
 * 以所有节点的外边界为基准，保留固定间距，计算缩略图显示范围。
 * 不设最小尺寸限制，始终紧密贴合实际节点分布。
 */
const minimapBounds = computed(() => {
  const nodes = props.editor.state.document.nodes
  if (nodes.length === 0) return { left: 0, top: 0, width: 1, height: 1 }

  const minNodeX = Math.min(...nodes.map((n: CanvasNode) => n.x))
  const minNodeY = Math.min(...nodes.map((n: CanvasNode) => n.y))
  const maxNodeX = Math.max(...nodes.map((n: CanvasNode) => n.x + n.width))
  const maxNodeY = Math.max(...nodes.map((n: CanvasNode) => n.y + n.height))

  return {
    left: minNodeX - NODE_PADDING,
    top: minNodeY - NODE_PADDING,
    width: (maxNodeX - minNodeX) + NODE_PADDING * 2,
    height: (maxNodeY - minNodeY) + NODE_PADDING * 2,
  }
})

/**
 * 缩放系数：让所有节点装入 minimap 内（保留 padding 边距）。
 * 使用 min(scaleX, scaleY) 保持比例。
 */
const scale = computed(() => {
  const b = minimapBounds.value
  if (b.width <= 0 || b.height <= 0) return 0
  const sx = (MINIMAP_WIDTH - PADDING * 2) / b.width
  const sy = (MINIMAP_HEIGHT - PADDING * 2) / b.height
  return Math.min(sx, sy)
})

/** 居中放置后的 x 偏移（剩余空间均分到两侧） */
const offsetX = computed(() => {
  const used = minimapBounds.value.width * scale.value
  return (MINIMAP_WIDTH - used) / 2
})

const offsetY = computed(() => {
  const used = minimapBounds.value.height * scale.value
  return (MINIMAP_HEIGHT - used) / 2
})

/**
 * 视口矩形：把 stage 上可见区域换算成 board 坐标，再映射到 minimap 尺寸。
 *
 * stage 内某个 stage 像素 (sx, sy) 对应 board 坐标
 *   bx = (sx - viewport.x) / viewport.scale
 *   by = (sy - viewport.y) / viewport.scale
 */
const viewportRect = computed(() => {
  const { scale: vScale, x: vx, y: vy } = props.editor.viewport
  if (vScale <= 0) return null
  const bxStart = -vx / vScale
  const byStart = -vy / vScale
  const bxEnd = (stageSize.value.width - vx) / vScale
  const byEnd = (stageSize.value.height - vy) / vScale
  const b = minimapBounds.value

  return {
    x: (bxStart - b.left) * scale.value + offsetX.value,
    y: (byStart - b.top) * scale.value + offsetY.value,
    width: (bxEnd - bxStart) * scale.value,
    height: (byEnd - byStart) * scale.value,
  }
})

/**
 * 将 minimap 内坐标 (mx, my) 视为新的视口中心点：
 *   stage 中心 (stageWidth/2, stageHeight/2) 应该正好显示这个 board 位置
 *   stageX = viewport.x + boardX * viewport.scale
 *   → viewport.x = stageX - boardX * viewport.scale
 */
function recenterViewportTo(mx: number, my: number) {
  const s = scale.value
  if (s <= 0) return
  const b = minimapBounds.value
  const boardX = (mx - offsetX.value) / s + b.left
  const boardY = (my - offsetY.value) / s + b.top
  const halfW = stageSize.value.width / 2
  const halfH = stageSize.value.height / 2
  props.editor.viewport.x = halfW - boardX * props.editor.viewport.scale
  props.editor.viewport.y = halfH - boardY * props.editor.viewport.scale
}

let dragging = false
let activePointerId: number | null = null

function localPoint(event: PointerEvent, target: HTMLElement) {
  const rect = target.getBoundingClientRect()
  return {
    x: ((event.clientX - rect.left) / rect.width) * MINIMAP_WIDTH,
    y: ((event.clientY - rect.top) / rect.height) * MINIMAP_HEIGHT,
  }
}

function onPointerDown(event: PointerEvent) {
  if (event.button !== 0) return
  const target = event.currentTarget as HTMLElement
  dragging = true
  activePointerId = event.pointerId
  target.setPointerCapture?.(event.pointerId)
  const pt = localPoint(event, target)
  recenterViewportTo(pt.x, pt.y)
  target.addEventListener("pointermove", onPointerMove)
  target.addEventListener("pointerup", onPointerUp)
  target.addEventListener("pointercancel", onPointerUp)
}

function onPointerMove(event: PointerEvent) {
  if (!dragging) return
  const target = event.currentTarget as HTMLElement
  const pt = localPoint(event, target)
  recenterViewportTo(pt.x, pt.y)
}

function onPointerUp(event: PointerEvent) {
  dragging = false
  const target = event.currentTarget as HTMLElement
  if (activePointerId !== null) {
    target.releasePointerCapture?.(activePointerId)
    activePointerId = null
  }
  target.removeEventListener("pointermove", onPointerMove)
  target.removeEventListener("pointerup", onPointerUp)
  target.removeEventListener("pointercancel", onPointerUp)
}
</script>

<style scoped lang="scss">
.canvas-minimap {
  position: absolute;
  right: 16px;
  bottom: 16px;
  z-index: 4;
  width: 180px;
  height: 120px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--canvas-floating-border);
  background: var(--canvas-floating-bg);
  box-shadow: var(--canvas-shadow);
  backdrop-filter: blur(14px);
  cursor: pointer;
  touch-action: none;
}

.canvas-minimap__svg {
  display: block;
  width: 100%;
  height: 100%;
}

.canvas-minimap__bg {
  fill: transparent;
}

.canvas-minimap__node {
  fill: color-mix(in srgb, var(--canvas-text) 40%, transparent);
  stroke: none;
}

.canvas-minimap__node--selected {
  fill: var(--canvas-accent);
}

.canvas-minimap__viewport {
  fill: var(--canvas-accent-soft);
  stroke: var(--canvas-accent);
  stroke-width: 1;
  stroke-linejoin: round;
  pointer-events: none;
}

@media (hover: none) and (pointer: coarse) {
  .canvas-minimap {
    width: 144px;
    height: 96px;
  }
}
</style>
