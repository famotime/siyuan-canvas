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
      class="file-card__document-preview markdown-preview"
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
import type { CanvasFileTargetPreview } from '@/canvas/file-target-preview'
import type { CanvasFileNode } from '@/canvas/types'

withDefaults(defineProps<{
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

.markdown-preview :deep(h1),
.markdown-preview :deep(h2),
.markdown-preview :deep(h3),
.markdown-preview :deep(h4),
.markdown-preview :deep(h5),
.markdown-preview :deep(h6) {
  margin-bottom: 10px;
  color: var(--canvas-text);
  line-height: 1.3;
}

.markdown-preview :deep(p),
.markdown-preview :deep(blockquote),
.markdown-preview :deep(pre),
.markdown-preview :deep(ul),
.markdown-preview :deep(ol) {
  margin-bottom: 10px;
}

.markdown-preview :deep(ul),
.markdown-preview :deep(ol) {
  padding-left: 20px;
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
</style>
