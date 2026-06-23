<template>
  <div
    class="canvas-dialog-backdrop"
    data-testid="create-edge-dialog"
    @click.self="editor.closeCreateEdgeDialog"
  >
    <div class="canvas-dialog">
      <div class="canvas-dialog__header">
        <h2>{{ t('createEdgeDialogTitle') }}</h2>
      </div>
      <div class="canvas-dialog__field">
        <span>{{ t('fieldSourceNode') }}</span>
        <div
          ref="sourceEdgePickerRef"
          class="canvas-node-picker"
        >
          <button
            class="canvas-node-picker__trigger canvas-dialog__control"
            data-testid="create-edge-source-trigger"
            type="button"
            @click="toggleEdgeNodePicker('source')"
          >
            <span class="canvas-node-picker__trigger-label" :title="getEdgeNodeTriggerLabel('source')">{{ getEdgeNodeTriggerLabel('source') }}</span>
            <span class="canvas-node-picker__trigger-chevron">{{ activeEdgeNodePicker === 'source' ? '▴' : '▾' }}</span>
          </button>
          <div
            v-if="activeEdgeNodePicker === 'source'"
            class="canvas-node-picker__panel"
          >
            <input
              ref="sourceEdgeSearchRef"
              v-model="editor.newEdgeSourceQuery"
              class="canvas-dialog__control canvas-node-picker__search"
              data-testid="create-edge-source-query"
              :placeholder="t('fieldSearchNodePlaceholder')"
            >
            <div
              class="canvas-node-picker__options"
              data-testid="create-edge-source-options"
            >
              <div
                v-for="node in editor.edgeSources"
                :key="node.id"
                class="canvas-node-picker__option"
                data-testid="create-edge-source-option"
                role="button"
                :title="editor.getNodeTitle(node)"
                @click="selectEdgeNodeOption('source', node.id)"
              >
                {{ editor.getNodeTitle(node) }}
              </div>
              <p
                v-if="editor.edgeSources.length === 0"
                class="canvas-node-picker__empty"
              >
                {{ t('fieldNoMatchingNodes') }}
              </p>
            </div>
          </div>
        </div>
      </div>
      <div class="canvas-dialog__field">
        <span>{{ t('fieldTarget') }}</span>
        <div
          ref="targetEdgePickerRef"
          class="canvas-node-picker"
        >
          <button
            class="canvas-node-picker__trigger canvas-dialog__control"
            data-testid="create-edge-target-trigger"
            type="button"
            @click="toggleEdgeNodePicker('target')"
          >
            <span class="canvas-node-picker__trigger-label" :title="getEdgeNodeTriggerLabel('target')">{{ getEdgeNodeTriggerLabel('target') }}</span>
            <span class="canvas-node-picker__trigger-chevron">{{ activeEdgeNodePicker === 'target' ? '▴' : '▾' }}</span>
          </button>
          <div
            v-if="activeEdgeNodePicker === 'target'"
            class="canvas-node-picker__panel"
          >
            <input
              ref="targetEdgeSearchRef"
              v-model="editor.newEdgeTargetQuery"
              class="canvas-dialog__control canvas-node-picker__search"
              data-testid="create-edge-target-query"
              :placeholder="t('fieldSearchNodePlaceholder')"
            >
            <div
              class="canvas-node-picker__options"
              data-testid="create-edge-target-options"
            >
              <div
                v-for="node in editor.edgeTargets"
                :key="node.id"
                class="canvas-node-picker__option"
                data-testid="create-edge-target-option"
                role="button"
                :title="editor.getNodeTitle(node)"
                @click="selectEdgeNodeOption('target', node.id)"
              >
                {{ editor.getNodeTitle(node) }}
              </div>
              <p
                v-if="editor.edgeTargets.length === 0"
                class="canvas-node-picker__empty"
              >
                {{ t('fieldNoMatchingNodes') }}
              </p>
            </div>
          </div>
        </div>
      </div>
      <label class="canvas-dialog__field">
        {{ t('fieldEdgeLabel') }}
        <input
          v-model="editor.newEdgeLabel"
          class="canvas-dialog__control"
        >
      </label>
      <div class="canvas-dialog__row">
        <label class="canvas-dialog__field">
          <span>{{ t('fieldFromSide') }}</span>
          <select
            v-model="editor.newEdgeFromSide"
            class="canvas-dialog__control"
          >
            <option
              v-for="side in editor.sides"
              :key="side"
              :value="side"
            >{{ getSideLabel(side) }}</option>
          </select>
        </label>
        <label class="canvas-dialog__field">
          <span>{{ t('fieldToSide') }}</span>
          <select
            v-model="editor.newEdgeToSide"
            class="canvas-dialog__control"
          >
            <option
              v-for="side in editor.sides"
              :key="side"
              :value="side"
            >{{ getSideLabel(side) }}</option>
          </select>
        </label>
      </div>
      <div class="canvas-dialog__actions">
        <button
          class="toolbar__button"
          type="button"
          @click="editor.closeCreateEdgeDialog"
        >
          {{ t('dialogCancel') }}
        </button>
        <button
          class="toolbar__button toolbar__button--primary"
          type="button"
          @click="editor.submitCreateEdgeDialog"
        >
          {{ t('inspectorCreateEdgeAction') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CanvasNode } from '@/canvas/types'

import {
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue'

type EdgeNodePickerKind = 'source' | 'target'

interface EdgeDialogEditor {
  closeCreateEdgeDialog: () => void
  edgeSources: CanvasNode[]
  edgeTargets: CanvasNode[]
  getNodeTitle: (node: CanvasNode) => string
  newEdgeFromSide: string
  newEdgeLabel: string
  newEdgeSourceId: string
  newEdgeSourceQuery: string
  newEdgeTargetId: string
  newEdgeTargetQuery: string
  newEdgeToSide: string
  setNewEdgeSourceId: (nodeId: string) => void
  setNewEdgeTargetId: (nodeId: string) => void
  sides: string[]
  submitCreateEdgeDialog: () => void
}

const props = defineProps<{
  editor: EdgeDialogEditor
  getSideLabel: (side: string) => string
  t: (key: string) => string
}>()

const activeEdgeNodePicker = ref<EdgeNodePickerKind | null>(null)
const sourceEdgePickerRef = ref<HTMLElement>()
const sourceEdgeSearchRef = ref<HTMLInputElement>()
const targetEdgePickerRef = ref<HTMLElement>()
const targetEdgeSearchRef = ref<HTMLInputElement>()

function getEdgeNodeTriggerLabel(kind: EdgeNodePickerKind): string {
  const nodeId = kind === 'source' ? props.editor.newEdgeSourceId : props.editor.newEdgeTargetId
  const fallbackLabel = kind === 'source' ? props.t('fieldSelectSourceNode') : props.t('fieldSelectTargetNode')
  const nodes = kind === 'source' ? props.editor.edgeSources : props.editor.edgeTargets
  const node = nodes.find((candidate) => candidate.id === nodeId)
  return node ? props.editor.getNodeTitle(node) : fallbackLabel
}

function toggleEdgeNodePicker(kind: EdgeNodePickerKind) {
  activeEdgeNodePicker.value = activeEdgeNodePicker.value === kind ? null : kind
}

function selectEdgeNodeOption(kind: EdgeNodePickerKind, nodeId: string) {
  if (kind === 'source') {
    props.editor.setNewEdgeSourceId(nodeId)
  } else {
    props.editor.setNewEdgeTargetId(nodeId)
  }

  activeEdgeNodePicker.value = null
}

function handleWindowPointerDown(event: PointerEvent) {
  if (!(event.target instanceof HTMLElement)) {
    activeEdgeNodePicker.value = null
    return
  }

  if (
    sourceEdgePickerRef.value?.contains(event.target)
    || targetEdgePickerRef.value?.contains(event.target)
  ) {
    return
  }

  activeEdgeNodePicker.value = null
}

onMounted(() => {
  window.addEventListener('pointerdown', handleWindowPointerDown)
})

onBeforeUnmount(() => {
  window.removeEventListener('pointerdown', handleWindowPointerDown)
})

watch(activeEdgeNodePicker, async (kind) => {
  if (!kind) {
    return
  }

  if (kind === 'source') {
    props.editor.newEdgeSourceQuery = ''
  } else {
    props.editor.newEdgeTargetQuery = ''
  }

  await nextTick()
  if (kind === 'source') {
    sourceEdgeSearchRef.value?.focus()
    return
  }

  targetEdgeSearchRef.value?.focus()
})
</script>

<style scoped lang="scss">
.canvas-dialog-backdrop {
  position: absolute;
  inset: 0;
  z-index: 6;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--b3-theme-on-surface) 24%, transparent);
  backdrop-filter: blur(4px);
}

.canvas-dialog {
  display: grid;
  gap: 12px;
  width: min(520px, calc(100% - 32px));
  padding: 18px;
  border: 1px solid var(--canvas-border);
  border-radius: 20px;
  background: var(--canvas-surface);
  box-shadow: var(--canvas-shadow-strong);
  box-sizing: border-box;
}

.canvas-dialog__header h2 {
  margin: 0;
  font-size: 16px;
  color: var(--canvas-text);
}

.canvas-dialog__field {
  display: grid;
  gap: 6px;
  min-width: 0;
  font-size: 12px;
  color: var(--canvas-text-muted);
}

.canvas-dialog__control {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  border: 1px solid var(--canvas-border);
  border-radius: 12px;
  background: var(--canvas-surface);
  padding: 9px 10px;
  font: inherit;
  color: var(--canvas-text);
}

.canvas-node-picker {
  position: relative;
  min-width: 0;
}

.canvas-node-picker__trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 12px;
  min-width: 0;
  box-sizing: border-box;
  overflow: hidden;
  text-align: left;
  cursor: pointer;
}

.canvas-node-picker__trigger-label {
  flex: 1 1 0;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.canvas-node-picker__trigger-chevron {
  flex: 0 0 auto;
  color: var(--canvas-text-muted);
}

.canvas-node-picker__panel {
  position: absolute;
  left: 0;
  right: 0;
  top: calc(100% + 8px);
  z-index: 2;
  display: grid;
  gap: 8px;
  padding: 10px;
  border: 1px solid var(--canvas-border);
  border-radius: 14px;
  background: var(--canvas-surface);
  box-shadow: var(--canvas-shadow);
}

.canvas-node-picker__search {
  margin: 0;
}

.canvas-node-picker__options {
  display: grid;
  gap: 6px;
  max-height: 220px;
  overflow: auto;
}

.canvas-node-picker__option {
  display: block;
  width: 100%;
  min-width: 0;
  height: auto;
  line-height: 1.5;
  border: 0;
  border-radius: 10px;
  background: var(--canvas-floating-button-bg);
  padding: 8px 10px;
  color: var(--canvas-text);
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
  box-sizing: border-box;
}

.canvas-node-picker__option:hover {
  background: var(--canvas-floating-button-bg-hover);
}

.canvas-node-picker__empty {
  margin: 0;
  padding: 8px 10px;
  color: var(--canvas-text-muted);
  font-size: 12px;
}

.canvas-dialog__row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.canvas-dialog__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.toolbar__button {
  border: 1px solid var(--canvas-border);
  border-radius: 12px;
  background: var(--canvas-surface);
  padding: 9px 14px;
  color: var(--canvas-text);
  cursor: pointer;
}

.toolbar__button--primary {
  border-color: transparent;
  background: var(--canvas-accent);
  color: var(--canvas-accent-contrast);
}
</style>
