<template>
  <div
    class="file-card"
    :title="tooltip"
  >
    <span class="file-card__badge">
      {{ preview.badge }}
    </span>
    <div
      v-if="preview.kind === 'canvas' && preview.thumbnail"
      class="file-card__canvas-preview"
    >
      <svg
        class="file-card__thumbnail"
        :viewBox="canvasThumbnailViewBox"
        preserveAspectRatio="xMidYMid meet"
      >
        <path
          v-for="(edge, edgeIndex) in preview.thumbnail.edges || []"
          :key="`thumbnail-edge-${node.id}-${edgeIndex}`"
          class="file-card__thumbnail-edge"
          :d="`M ${edge.fromX} ${edge.fromY} L ${edge.toX} ${edge.toY}`"
        />
        <rect
          v-for="(thumbnailNode, thumbnailIndex) in preview.thumbnail.nodes || []"
          :key="`thumbnail-node-${node.id}-${thumbnailIndex}`"
          class="file-card__thumbnail-node"
          rx="16"
          :height="thumbnailNode.height"
          :width="thumbnailNode.width"
          :x="thumbnailNode.x"
          :y="thumbnailNode.y"
        />
      </svg>
    </div>
    <img
      v-if="imageSrc"
      :src="imageSrc"
      alt=""
      class="file-card__image"
      @error="emit('image-error', node)"
    >
    <div
      v-if="showHeadline"
      class="canvas-node__title"
    >
      {{ preview.headline }}
    </div>
    <div
      v-if="showDetail"
      class="canvas-node__meta"
    >
      {{ preview.detail }}
    </div>
    <div
      v-if="['block', 'document'].includes(preview.kind) && documentPreviewHtml"
      ref="documentPreviewRef"
      class="file-card__document-preview markdown-preview protyle-wysiwyg"
      v-html="documentPreviewHtml"
      @error.capture="emit('preview-image-error', node, $event)"
    />
    <div
      v-if="showHelper"
      class="file-card__helper"
    >
      {{ preview.helper }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, onUpdated, ref, watch } from 'vue'
import type { CanvasFileTargetPreview } from '@/canvas/file-target-preview'
import { triggerNativeProtyleRender } from '@/canvas/protyle-native-render'
import type { CanvasFileNode } from '@/canvas/types'

const props = withDefaults(defineProps<{
  canvasThumbnailViewBox?: string
  documentPreviewHtml: string
  imageSrc?: string
  node: CanvasFileNode
  preview: CanvasFileTargetPreview
  showDetail: boolean
  showHelper?: boolean
  showHeadline: boolean
  tooltip?: string
}>(), {
  showHelper: true,
})

const emit = defineEmits<{
  'image-error': [node: CanvasFileNode]
  'preview-image-error': [node: CanvasFileNode, event: Event]
}>()

const documentPreviewRef = ref<HTMLElement | null>(null)

function scheduleNativeRender() {
  void nextTick(() => {
    triggerNativeProtyleRender(documentPreviewRef.value)
  })
}

onMounted(() => {
  scheduleNativeRender()
})

onUpdated(() => {
  scheduleNativeRender()
})

watch(() => props.documentPreviewHtml, () => {
  scheduleNativeRender()
})
</script>

<style scoped lang="scss">
.file-card {
  display: grid;
  gap: 8px;
}

.file-card:has(.file-card__image) {
  height: 100%;
  grid-template-rows: auto minmax(0, 1fr);
}

.file-card:has(.file-card__canvas-preview) {
  height: 100%;
  grid-template-rows: auto minmax(0, 1fr);
}

.file-card:has(.file-card__document-preview) {
  height: 100%;
  grid-template-rows: auto auto minmax(0, 1fr);
}

.file-card__badge {
  justify-self: start;
  border-radius: 999px;
  background: var(--canvas-accent-soft);
  color: var(--canvas-text);
  padding: 4px 8px;
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.file-card__image {
  display: block;
  width: 100%;
  height: 100%;
  min-height: 0;
  object-fit: contain;
  border-radius: 12px;
  border: 1px solid var(--canvas-border);
  background: var(--canvas-surface);
}

.file-card__canvas-preview {
  height: 100%;
  min-height: 132px;
  overflow: hidden;
  border-radius: 12px;
  border: 1px solid var(--canvas-border);
  background:
    linear-gradient(180deg, rgba(53, 103, 214, 0.08), rgba(15, 23, 42, 0.02)),
    var(--canvas-surface);
}

.file-card__thumbnail {
  display: block;
  width: 100%;
  height: 100%;
}

.file-card__thumbnail-edge {
  fill: none;
  stroke: rgba(53, 103, 214, 0.58);
  stroke-linecap: round;
  stroke-width: 10px;
}

.file-card__thumbnail-node {
  fill: rgba(255, 255, 255, 0.88);
  stroke: rgba(15, 23, 42, 0.12);
  stroke-width: 4px;
}

.file-card__document-preview {
  margin-top: 2px;
  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
}

.file-card__helper {
  font-size: 12px;
  color: var(--canvas-text-muted);
}

.canvas-node__title {
  font-weight: 600;
  line-height: 1.4;
  word-break: break-word;
}

.canvas-node__meta {
  margin-top: 8px;
  font-size: 12px;
  color: var(--canvas-text-muted);
  word-break: break-all;
}

.markdown-preview {
  white-space: normal;
  color: var(--canvas-text);
}

.markdown-preview :deep(*) {
  margin: 0;
}

.markdown-preview :deep(h1) {
  margin-top: 14px;
  margin-bottom: 8px;
  color: var(--canvas-text);
  font-size: 1.55em;
  font-weight: 700;
  line-height: 1.3;
}

.markdown-preview :deep(h2) {
  margin-top: 12px;
  margin-bottom: 6px;
  color: var(--canvas-text);
  font-size: 1.35em;
  font-weight: 600;
  line-height: 1.3;
}

.markdown-preview :deep(h3) {
  margin-top: 10px;
  margin-bottom: 6px;
  color: var(--canvas-text);
  font-size: 1.18em;
  font-weight: 600;
  line-height: 1.35;
}

.markdown-preview :deep(h4) {
  margin-top: 8px;
  margin-bottom: 4px;
  color: var(--canvas-text);
  font-size: 1.06em;
  font-weight: 600;
  line-height: 1.4;
}

.markdown-preview :deep(h5) {
  margin-top: 6px;
  margin-bottom: 4px;
  color: var(--canvas-text);
  font-size: 0.98em;
  font-weight: 600;
  line-height: 1.4;
}

.markdown-preview :deep(h6) {
  margin-top: 6px;
  margin-bottom: 4px;
  color: var(--canvas-text-muted, var(--canvas-text));
  font-size: 0.9em;
  font-weight: 600;
  line-height: 1.4;
}

.markdown-preview :deep(> :first-child) {
  margin-top: 0 !important;
}

.markdown-preview :deep(> :last-child) {
  margin-bottom: 0 !important;
}

.markdown-preview :deep(p),
.markdown-preview :deep(blockquote),
.markdown-preview :deep(pre),
.markdown-preview :deep(ul),
.markdown-preview :deep(ol) {
  margin-bottom: 10px;
}

.markdown-preview :deep(ul) {
  list-style-type: disc;
  list-style-position: outside;
  padding-left: 22px;
}

.markdown-preview :deep(ol) {
  list-style-type: decimal;
  list-style-position: outside;
  padding-left: 22px;
}

.markdown-preview :deep(li) {
  display: list-item;
  margin-bottom: 4px;
}

.markdown-preview :deep(li > p) {
  margin-bottom: 4px;
}

.markdown-preview :deep(ul ul),
.markdown-preview :deep(ol ul) {
  list-style-type: circle;
  margin-top: 4px;
  margin-bottom: 4px;
  padding-left: 20px;
}

.markdown-preview :deep(ul ul ul),
.markdown-preview :deep(ol ul ul),
.markdown-preview :deep(ul ol ul),
.markdown-preview :deep(ol ol ul) {
  list-style-type: square;
}

.markdown-preview :deep(ol ol),
.markdown-preview :deep(ul ol) {
  list-style-type: lower-alpha;
  margin-top: 4px;
  margin-bottom: 4px;
  padding-left: 20px;
}

.markdown-preview :deep(ol ol ol),
.markdown-preview :deep(ul ol ol),
.markdown-preview :deep(ol ol ol),
.markdown-preview :deep(ul ul ol) {
  list-style-type: lower-roman;
}

.markdown-preview :deep(ul.task-list),
.markdown-preview :deep(ol.task-list) {
  list-style-type: none;
  padding-left: 4px;
}

.markdown-preview :deep(li.task-list-item) {
  list-style-type: none;
  display: flex;
  align-items: flex-start;
  gap: 6px;
}

.markdown-preview :deep(li.task-list-item input.task-list-item-checkbox) {
  margin: 3px 0 0 0;
  cursor: default;
  flex-shrink: 0;
}

.markdown-preview :deep(blockquote) {
  border-left: 3px solid var(--canvas-border-strong);
  padding-left: 10px;
  color: var(--canvas-text-muted);
}

.markdown-preview :deep(code) {
  border-radius: 6px;
  background: var(--canvas-code-bg);
  padding: 2px 6px;
  font-size: 12px;
}

.markdown-preview :deep(pre) {
  overflow: auto;
  border-radius: 10px;
  background: var(--canvas-code-bg);
  padding: 10px;
}

.markdown-preview :deep(pre code) {
  background: transparent;
  padding: 0;
}

.markdown-preview :deep(p:has(> img)) {
  display: flex;
  justify-content: center;
  align-items: center;
  max-height: 100%;
}

.markdown-preview :deep(img) {
  display: block;
  max-width: 100%;
  max-height: 100%;
  height: auto;
  object-fit: contain;
  border-radius: 12px;
}

.markdown-preview :deep(a) {
  color: var(--canvas-accent);
  text-decoration: underline;
}

.markdown-preview :deep(table) {
  width: 100%;
  max-width: 100%;
  margin-top: 6px;
  margin-bottom: 12px;
  border-collapse: collapse;
  border-spacing: 0;
  empty-cells: show;
  border: 1px solid var(--canvas-border, var(--b3-border-color));
  border-radius: 6px;
  font-size: 13px;
  line-height: 1.5;
  box-sizing: border-box;
}

.markdown-preview :deep(thead) {
  background: var(--canvas-code-bg, color-mix(in srgb, var(--b3-theme-on-surface) 6%, transparent));
  color: var(--canvas-text);
  font-weight: 600;
}

.markdown-preview :deep(th),
.markdown-preview :deep(td) {
  padding: 6px 12px;
  border: 1px solid var(--canvas-border, var(--b3-border-color));
  text-align: left;
  vertical-align: middle;
  word-break: break-word;
}

.markdown-preview :deep(th) {
  font-weight: 600;
  background: var(--canvas-code-bg, color-mix(in srgb, var(--b3-theme-on-surface) 6%, transparent));
}

.markdown-preview :deep(tbody tr:nth-child(even)) {
  background: color-mix(in srgb, var(--b3-theme-on-surface) 3%, transparent);
}

.markdown-preview :deep(tbody tr:hover) {
  background: color-mix(in srgb, var(--b3-theme-on-surface) 6%, transparent);
}

.markdown-preview :deep(th[align="center"]),
.markdown-preview :deep(td[align="center"]) {
  text-align: center;
}

.markdown-preview :deep(th[align="right"]),
.markdown-preview :deep(td[align="right"]) {
  text-align: right;
}
</style>
