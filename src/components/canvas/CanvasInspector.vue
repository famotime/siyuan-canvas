<template>
  <section
    v-if="editor.selectedNode"
    class="inspector__section"
    data-testid="inspector-node"
  >
    <button
      class="inspector__section-toggle"
      :title="getSectionToggleTitle('selection')"
      type="button"
      @click="editor.toggleInspectorSection('selection')"
    >
      <h2>{{ t("inspectorNode") }}</h2>
      <span>{{ getSectionChevron('selection') }}</span>
    </button>
    <div v-if="editor.inspectorSectionState.selection">
      <p
        v-if="editor.selectedNodeCount > 1"
        data-testid="inspector-selection-count"
      >
        {{ t("selectionCount", { count: editor.selectedNodeCount }) }}
      </p>
      <label>
        {{ t("fieldX") }}
        <input
          data-testid="inspector-node-x"
          :value="isNaN(getDraftValue('x')) ? '' : getDraftValue('x')"
          :placeholder="isNaN(getDraftValue('x')) ? '--' : ''"
          type="number"
          @input="handleNumberInput('x', $event)"
        />
      </label>
      <label>
        {{ t("fieldY") }}
        <input
          data-testid="inspector-node-y"
          :value="isNaN(getDraftValue('y')) ? '' : getDraftValue('y')"
          :placeholder="isNaN(getDraftValue('y')) ? '--' : ''"
          type="number"
          @input="handleNumberInput('y', $event)"
        />
      </label>
      <label>
        {{ t("fieldWidth") }}
        <input
          data-testid="inspector-node-width"
          :value="isNaN(getDraftValue('width')) ? '' : getDraftValue('width')"
          :placeholder="isNaN(getDraftValue('width')) ? '--' : ''"
          type="number"
          @input="handleNumberInput('width', $event)"
        />
      </label>
      <label>
        {{ t("fieldHeight") }}
        <input
          data-testid="inspector-node-height"
          :value="isNaN(getDraftValue('height')) ? '' : getDraftValue('height')"
          :placeholder="isNaN(getDraftValue('height')) ? '--' : ''"
          type="number"
          @input="handleNumberInput('height', $event)"
        />
      </label>
      <label v-if="'color' in editor.selectedNode">
        {{ t("fieldColor") }}
        <input
          data-testid="inspector-node-color"
          :value="editor.selectedNode.color || ''"
          @input="editor.updateNodeField('color', valueFromEvent($event))"
        />
      </label>
      <label v-if="editor.selectedNode.type === 'text'">
        {{ t("fieldText") }}
        <textarea
          data-testid="inspector-node-text"
          :value="getDraftText()"
          :placeholder="isTextMixed() ? '--' : ''"
          @input="handleTextInput($event)"
        />
      </label>
      <label v-if="editor.selectedNode.type === 'file'">
        {{ t("fieldFilePath") }}
        <input
          data-testid="inspector-node-file"
          :value="getDraftText()"
          :placeholder="isTextMixed() ? '--' : ''"
          @input="handleTextInput($event)"
        />
      </label>
      <label v-if="editor.selectedNode.type === 'link'">
        {{ t("fieldUrl") }}
        <input
          data-testid="inspector-node-url"
          :value="getDraftText()"
          :placeholder="isTextMixed() ? '--' : ''"
          @input="handleTextInput($event)"
        />
      </label>
      <label v-if="editor.selectedNode.type === 'group'">
        {{ t("fieldLabel") }}
        <input
          data-testid="inspector-node-label"
          :value="getDraftText()"
          :placeholder="isTextMixed() ? '--' : ''"
          @input="handleTextInput($event)"
        />
      </label>
      <button
        v-if="isMultiNodeSelection"
        class="inspector__action-button"
        data-testid="inspector-node-apply"
        type="button"
        @click="applyDraft"
      >
        {{ t("dialogConfirm") }}
      </button>
    </div>
  </section>

  <section
    v-if="editor.selectedNodeCount === 1 && nodeEdges.length > 0"
    class="inspector__section"
  >
    <button
      class="inspector__section-toggle"
      :title="getSectionToggleTitle('nodeEdges')"
      type="button"
      @click="editor.toggleInspectorSection('nodeEdges')"
    >
      <h2>{{ t("inspectorNodeEdges") }}</h2>
      <span>{{ getSectionChevron('nodeEdges') }}</span>
    </button>
    <div v-if="editor.inspectorSectionState.nodeEdges">
      <div
        v-for="edgeInfo in nodeEdges"
        :key="edgeInfo.edge.id"
        class="node-edge-item"
      >
        <div class="node-edge-item__side">
          {{ getSideLabel(edgeInfo.localSide) }}
        </div>
        <div class="node-edge-item__info">
          <span class="node-edge-item__direction">{{ edgeInfo.direction === 'outgoing' ? '→' : '←' }}</span>
          <button
            class="node-edge-item__node"
            type="button"
            :title="edgeInfo.connectedNodeTitle"
            @click="focusConnectedNode(edgeInfo.connectedNodeId)"
          >{{ edgeInfo.connectedNodeTitle }}</button>
          <button
            class="node-edge-item__focus"
            type="button"
            :title="t('inspectorFocusNode')"
            @click="focusConnectedNode(edgeInfo.connectedNodeId)"
          >⊙</button>
          <span
            v-if="edgeInfo.edge.label"
            class="node-edge-item__label"
            :title="edgeInfo.edge.label"
          >{{ edgeInfo.edge.label }}</span>
        </div>
      </div>
    </div>
  </section>

  <section
    v-if="editor.selectedNodeCount === 1"
    class="inspector__section"
  >
    <button
      class="inspector__section-toggle"
      :title="getSectionToggleTitle('createEdge')"
      type="button"
      @click="editor.toggleInspectorSection('createEdge')"
    >
      <h2>{{ t("inspectorCreateEdge") }}</h2>
      <span>{{ getSectionChevron('createEdge') }}</span>
    </button>
    <div v-if="editor.inspectorSectionState.createEdge">
      <span class="inspector__field-label">{{ t("fieldSourceNode") }}</span>
      <div
        ref="inspSourcePickerRef"
        class="insp-node-picker"
      >
        <button
          ref="inspSourceTriggerRef"
          class="insp-node-picker__trigger"
          type="button"
          @click="toggleInspPicker('source')"
        >
          <span
            class="insp-node-picker__trigger-label"
            :style="getInspPickerLabelStyle('source')"
            :title="getInspPickerLabel('source')"
          >{{ getInspPickerLabel('source') }}</span>
          <span
            ref="inspSourceChevronRef"
            class="insp-node-picker__trigger-chevron"
          >{{ activeInspPicker === 'source' ? '▴' : '▾' }}</span>
        </button>
        <div
          v-if="activeInspPicker === 'source'"
          class="insp-node-picker__panel"
        >
          <input
            ref="inspSourceSearchRef"
            v-model="editor.newEdgeSourceQuery"
            class="insp-node-picker__search"
            :placeholder="t('fieldSearchNodePlaceholder')"
          >
          <div class="insp-node-picker__options">
            <button
              v-for="node in editor.edgeSources"
              :key="node.id"
              class="insp-node-picker__option"
              type="button"
              :title="editor.getNodeTitle(node)"
              @click="selectInspNode('source', node.id)"
            >
              {{ editor.getNodeTitle(node) }}
            </button>
            <p
              v-if="editor.edgeSources.length === 0"
              class="insp-node-picker__empty"
            >
              {{ t('fieldNoMatchingNodes') }}
            </p>
          </div>
        </div>
      </div>
      <span class="inspector__field-label">{{ t("fieldTarget") }}</span>
      <div
        ref="inspTargetPickerRef"
        class="insp-node-picker"
      >
        <button
          ref="inspTargetTriggerRef"
          class="insp-node-picker__trigger"
          type="button"
          @click="toggleInspPicker('target')"
        >
          <span
            class="insp-node-picker__trigger-label"
            :style="getInspPickerLabelStyle('target')"
            :title="getInspPickerLabel('target')"
          >{{ getInspPickerLabel('target') }}</span>
          <span
            ref="inspTargetChevronRef"
            class="insp-node-picker__trigger-chevron"
          >{{ activeInspPicker === 'target' ? '▴' : '▾' }}</span>
        </button>
        <div
          v-if="activeInspPicker === 'target'"
          class="insp-node-picker__panel"
        >
          <input
            ref="inspTargetSearchRef"
            v-model="editor.newEdgeTargetQuery"
            class="insp-node-picker__search"
            :placeholder="t('fieldSearchNodePlaceholder')"
          >
          <div class="insp-node-picker__options">
            <button
              v-for="node in editor.edgeTargets"
              :key="node.id"
              class="insp-node-picker__option"
              type="button"
              :title="editor.getNodeTitle(node)"
              @click="selectInspNode('target', node.id)"
            >
              {{ editor.getNodeTitle(node) }}
            </button>
            <p
              v-if="editor.edgeTargets.length === 0"
              class="insp-node-picker__empty"
            >
              {{ t('fieldNoMatchingNodes') }}
            </p>
          </div>
        </div>
      </div>
      <label>
        {{ t("fieldEdgeLabel") }}
        <input v-model="editor.newEdgeLabel" />
      </label>
      <label>
        {{ t("fieldFromSide") }}
        <select v-model="editor.newEdgeFromSide">
          <option
            v-for="side in editor.sides"
            :key="side"
            :value="side"
          >{{ getSideLabel(side) }}</option>
        </select>
      </label>
      <label>
        {{ t("fieldToSide") }}
        <select v-model="editor.newEdgeToSide">
          <option
            v-for="side in editor.sides"
            :key="side"
            :value="side"
          >{{ getSideLabel(side) }}</option>
        </select>
      </label>
      <button
        class="inspector__action-button"
        @click="editor.createEdgeFromSelection"
      >
        {{ t("inspectorCreateEdgeAction") }}
      </button>
    </div>
  </section>

  <section
    v-if="editor.selectedEdge"
    class="inspector__section"
  >
    <button
      class="inspector__section-toggle"
      :title="getSectionToggleTitle('edge')"
      type="button"
      @click="editor.toggleInspectorSection('edge')"
    >
      <h2>{{ t("inspectorEdge") }}</h2>
      <span>{{ getSectionChevron('edge') }}</span>
    </button>
    <div v-if="editor.inspectorSectionState.edge">
      <label>
        {{ t("fieldEdgeLabel") }}
        <input
          :value="editor.selectedEdge.label || ''"
          @input="editor.updateEdgeField('label', valueFromEvent($event))"
        />
      </label>
      <label>
        {{ t("fieldSourceNode") }}
        <input
          :value="selectedEdgeFromNodeTitle"
          readonly
          class="inspector__readonly-field"
        />
      </label>
      <label>
        {{ t("fieldTarget") }}
        <input
          :value="selectedEdgeToNodeTitle"
          readonly
          class="inspector__readonly-field"
        />
      </label>
      <label>
        {{ t("fieldFromSide") }}
        <select
          :value="editor.selectedEdge.fromSide"
          @change="editor.updateEdgeSide('fromSide', valueFromEvent($event))"
        >
          <option
            v-for="side in editor.sides"
            :key="side"
            :value="side"
          >{{ getSideLabel(side) }}</option>
        </select>
      </label>
      <label>
        {{ t("fieldToSide") }}
        <select
          :value="editor.selectedEdge.toSide"
          @change="editor.updateEdgeSide('toSide', valueFromEvent($event))"
        >
          <option
            v-for="side in editor.sides"
            :key="side"
            :value="side"
          >{{ getSideLabel(side) }}</option>
        </select>
      </label>
    </div>
  </section>
</template>

<script lang="ts">
export default { name: "CanvasInspector" }
</script>

<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
} from 'vue'

const props = defineProps<{
  editor: Record<string, any>
  getSideLabel: (side: string) => string
  t: (key: string, args?: Record<string, unknown>) => string
}>()

const selectedEdgeFromNodeTitle = computed(() => {
  const edge = props.editor.selectedEdge
  if (!edge) return ''
  const node = props.editor.state.document.nodes.find((n: any) => n.id === edge.fromNode)
  return node ? props.editor.getNodeTitle(node) : edge.fromNode
})

const selectedEdgeToNodeTitle = computed(() => {
  const edge = props.editor.selectedEdge
  if (!edge) return ''
  const node = props.editor.state.document.nodes.find((n: any) => n.id === edge.toNode)
  return node ? props.editor.getNodeTitle(node) : edge.toNode
})

interface NodeEdgeInfo {
  edge: any
  localSide: string
  direction: 'incoming' | 'outgoing'
  connectedNodeId: string
  connectedNodeTitle: string
}

const nodeEdges = computed<NodeEdgeInfo[]>(() => {
  const node = props.editor.selectedNode
  if (!node) return []
  const edges: any[] = props.editor.state.document.edges
  const nodes: any[] = props.editor.state.document.nodes
  const result: NodeEdgeInfo[] = []
  for (const edge of edges) {
    if (edge.fromNode === node.id) {
      const connected = nodes.find((n: any) => n.id === edge.toNode)
      result.push({
        edge,
        localSide: edge.fromSide,
        direction: 'outgoing',
        connectedNodeTitle: connected ? props.editor.getNodeTitle(connected) : edge.toNode,
      })
    } else if (edge.toNode === node.id) {
      const connected = nodes.find((n: any) => n.id === edge.fromNode)
      result.push({
        edge,
        localSide: edge.toSide,
        direction: 'incoming',
        connectedNodeTitle: connected ? props.editor.getNodeTitle(connected) : edge.fromNode,
      })
    }
  }
  return result
})

type InspPickerKind = 'source' | 'target'

const activeInspPicker = ref<InspPickerKind | null>(null)
const inspSourcePickerRef = ref<HTMLElement>()
const inspSourceSearchRef = ref<HTMLInputElement>()
const inspSourceTriggerRef = ref<HTMLButtonElement>()
const inspSourceChevronRef = ref<HTMLElement>()
const inspTargetPickerRef = ref<HTMLElement>()
const inspTargetSearchRef = ref<HTMLInputElement>()
const inspTargetTriggerRef = ref<HTMLButtonElement>()
const inspTargetChevronRef = ref<HTMLElement>()

const inspPickerLabelMaxWidths = reactive<Record<InspPickerKind, number>>({
  source: 0,
  target: 0,
})

let inspPickerResizeObserver: ResizeObserver | undefined

function getInspPickerLabel(kind: InspPickerKind): string {
  const nodeId = kind === 'source' ? props.editor.newEdgeSourceId : props.editor.newEdgeTargetId
  const fallbackLabel = kind === 'source' ? props.t('fieldSelectSourceNode') : props.t('fieldSelectTargetNode')
  const nodes = kind === 'source' ? props.editor.edgeSources : props.editor.edgeTargets
  const node = nodes.find((candidate: any) => candidate.id === nodeId)
  return node ? props.editor.getNodeTitle(node) : fallbackLabel
}

function getInspPickerLabelStyle(kind: InspPickerKind): Record<string, string> {
  const width = inspPickerLabelMaxWidths[kind]
  return width > 0
    ? { '--insp-node-picker-label-max-width': `${width}px` }
    : {}
}

function getNumericStyleValue(styles: CSSStyleDeclaration, property: string): number {
  const value = Number.parseFloat(styles.getPropertyValue(property))
  return Number.isFinite(value) ? value : 0
}

function updateInspPickerLabelMaxWidth(kind: InspPickerKind): void {
  const trigger = kind === 'source' ? inspSourceTriggerRef.value : inspTargetTriggerRef.value
  if (!trigger) {
    inspPickerLabelMaxWidths[kind] = 0
    return
  }

  const chevron = kind === 'source' ? inspSourceChevronRef.value : inspTargetChevronRef.value
  const styles = window.getComputedStyle(trigger)
  const availableWidth = trigger.clientWidth
    - getNumericStyleValue(styles, 'padding-left')
    - getNumericStyleValue(styles, 'padding-right')
    - getNumericStyleValue(styles, 'column-gap')
    - (chevron?.offsetWidth ?? 0)

  inspPickerLabelMaxWidths[kind] = Math.max(0, Math.floor(availableWidth))
}

function updateInspPickerLabelMaxWidths(): void {
  updateInspPickerLabelMaxWidth('source')
  updateInspPickerLabelMaxWidth('target')
}

function toggleInspPicker(kind: InspPickerKind) {
  activeInspPicker.value = activeInspPicker.value === kind ? null : kind
}

function selectInspNode(kind: InspPickerKind, nodeId: string) {
  if (kind === 'source') {
    props.editor.setNewEdgeSourceId(nodeId)
  } else {
    props.editor.setNewEdgeTargetId(nodeId)
  }
  activeInspPicker.value = null
}

function handleInspPointerDown(event: PointerEvent) {
  if (!(event.target instanceof HTMLElement)) {
    activeInspPicker.value = null
    return
  }
  if (
    inspSourcePickerRef.value?.contains(event.target)
    || inspTargetPickerRef.value?.contains(event.target)
  ) {
    return
  }
  activeInspPicker.value = null
}

onMounted(() => {
  window.addEventListener('pointerdown', handleInspPointerDown)
  nextTick(updateInspPickerLabelMaxWidths)
  if (typeof ResizeObserver !== 'undefined') {
    inspPickerResizeObserver = new ResizeObserver(updateInspPickerLabelMaxWidths)
    if (inspSourceTriggerRef.value) {
      inspPickerResizeObserver.observe(inspSourceTriggerRef.value)
    }
    if (inspTargetTriggerRef.value) {
      inspPickerResizeObserver.observe(inspTargetTriggerRef.value)
    }
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('pointerdown', handleInspPointerDown)
  inspPickerResizeObserver?.disconnect()
})

watch(activeInspPicker, async (kind) => {
  if (!kind) return
  if (kind === 'source') {
    props.editor.newEdgeSourceQuery = ''
  } else {
    props.editor.newEdgeTargetQuery = ''
  }
  await nextTick()
  if (kind === 'source') {
    inspSourceSearchRef.value?.focus()
    return
  }
  inspTargetSearchRef.value?.focus()
})

const multiNodeDraft = reactive({
  height: 0,
  text: '',
  width: 0,
  x: 0,
  y: 0,
})

const draftEditedFields = reactive(new Set<string>())

const isMultiNodeSelection = computed(() => props.editor.selectedNodeCount > 1)

const allSelectedNodes = computed(() => {
  const ids = new Set(props.editor.state.selectedNodeIds)
  return props.editor.state.document.nodes.filter((n: any) => ids.has(n.id))
})

function getNodeTextField(node: any): string {
  if (node.type === 'group') return node.label || ''
  if (node.type === 'file') return node.file
  if (node.type === 'link') return node.url
  return node.text
}

const mixedFields = computed(() => {
  if (!isMultiNodeSelection.value) return {} as Record<string, boolean>
  const nodes = allSelectedNodes.value
  if (nodes.length < 2) return {} as Record<string, boolean>

  const result: Record<string, boolean> = {}
  for (const field of ['x', 'y', 'width', 'height'] as const) {
    const firstVal = nodes[0][field]
    result[field] = !nodes.every((n: any) => n[field] === firstVal)
  }

  const firstText = getNodeTextField(nodes[0])
  result.text = !nodes.every((n: any) => getNodeTextField(n) === firstText)

  return result
})

watch(
  () => props.editor.selectedNode,
  (node) => {
    if (!node) {
      return
    }

    draftEditedFields.clear()
    multiNodeDraft.x = node.x
    multiNodeDraft.y = node.y
    multiNodeDraft.width = node.width
    multiNodeDraft.height = node.height
    multiNodeDraft.text = node.type === 'group'
      ? (node.label || '')
      : node.type === 'file'
        ? node.file
        : node.type === 'link'
          ? node.url
          : node.text
  },
  { immediate: true },
)

function valueFromEvent(event: Event): string {
  return (event.target as HTMLInputElement).value
}

function getDraftValue(field: 'height' | 'width' | 'x' | 'y'): number {
  if (!isMultiNodeSelection.value) {
    return props.editor.selectedNode[field]
  }
  if (mixedFields.value[field] && !draftEditedFields.has(field)) {
    return NaN
  }
  return multiNodeDraft[field]
}

function getDraftText(): string {
  if (isMultiNodeSelection.value) {
    if (mixedFields.value.text && !draftEditedFields.has('text')) {
      return ''
    }
    return multiNodeDraft.text
  }

  const node = props.editor.selectedNode
  if (node.type === 'group') {
    return node.label || ''
  }
  if (node.type === 'file') {
    return node.file
  }
  if (node.type === 'link') {
    return node.url
  }
  return node.text
}

function isTextMixed(): boolean {
  return !!mixedFields.value.text && !draftEditedFields.has('text')
}

function handleNumberInput(field: 'height' | 'width' | 'x' | 'y', event: Event): void {
  const value = valueFromEvent(event)
  if (isMultiNodeSelection.value) {
    const numeric = Number.parseFloat(value)
    if (!Number.isNaN(numeric)) {
      multiNodeDraft[field] = numeric
      draftEditedFields.add(field)
    }
    return
  }

  props.editor.updateNumericNodeField(field, value)
}

function handleTextInput(event: Event): void {
  const value = valueFromEvent(event)
  if (isMultiNodeSelection.value) {
    multiNodeDraft.text = value
    draftEditedFields.add('text')
    return
  }

  const node = props.editor.selectedNode
  if (node.type === 'text') {
    props.editor.updateNodeField('text', value)
  } else if (node.type === 'file') {
    props.editor.updateNodeField('file', value)
  } else if (node.type === 'link') {
    props.editor.updateNodeField('url', value)
  } else if (node.type === 'group') {
    props.editor.updateNodeField('label', value)
  }
}

function applyDraft(): void {
  const fields: Record<string, unknown> = {}
  for (const key of draftEditedFields) {
    fields[key] = (multiNodeDraft as Record<string, unknown>)[key]
  }
  props.editor.applySelectedNodeChanges(fields)
}

function focusConnectedNode(nodeId: string): void {
  props.editor.focusNodeById(nodeId)
}

function getSectionChevron(section: keyof typeof props.editor.inspectorSectionState): string {
  return props.editor.inspectorSectionState[section] ? "−" : "+"
}

function getSectionToggleTitle(section: keyof typeof props.editor.inspectorSectionState): string {
  return props.editor.inspectorSectionState[section]
    ? props.t("inspectorCollapseSection")
    : props.t("inspectorExpandSection")
}
</script>

<style scoped>
.inspector__section {
  display: grid;
  gap: 12px;
  margin-bottom: 0;
  padding: 16px;
  border: 1px solid var(--canvas-border);
  border-radius: 16px;
  background: var(--canvas-inspector-section-bg);
  min-width: 0;
  overflow: hidden;
}

.inspector__action-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 10px 16px;
  margin-top: 4px;
  border: 1px solid var(--canvas-accent-soft);
  border-radius: 12px;
  background: linear-gradient(
    135deg,
    var(--canvas-accent-soft),
    color-mix(in srgb, var(--canvas-accent) 18%, transparent)
  );
  color: var(--canvas-accent);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  cursor: pointer;
  transition:
    background 150ms ease,
    border-color 150ms ease,
    box-shadow 150ms ease,
    transform 120ms ease;
  backdrop-filter: blur(8px);
}

.inspector__action-button:hover {
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--canvas-accent) 24%, transparent),
    color-mix(in srgb, var(--canvas-accent) 14%, transparent)
  );
  border-color: var(--canvas-accent);
  box-shadow: 0 2px 8px var(--canvas-accent-soft);
  transform: translateY(-1px);
}

.inspector__action-button:active {
  transform: translateY(0);
  box-shadow: none;
}

.inspector__section-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  border: 0;
  background: transparent;
  padding: 0;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.inspector__section h2 {
  margin: 0;
  font-size: 13px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--canvas-text-muted);
}

.inspector__section label {
  display: grid;
  gap: 6px;
  font-size: 12px;
  color: var(--canvas-text-muted);
}

.inspector__section input,
.inspector__section select,
.inspector__section textarea {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  padding: 8px 10px;
  border: 1px solid var(--canvas-border);
  border-radius: 10px;
  background: var(--canvas-input-bg);
  color: var(--canvas-text);
  font: inherit;
}

.inspector__section textarea {
  min-height: 120px;
  resize: vertical;
}

.inspector__readonly-field {
  cursor: default;
  opacity: 0.7;
}

.inspector__field-label {
  display: block;
  font-size: 12px;
  color: var(--canvas-text-muted);
}

.insp-node-picker {
  position: relative;
  min-width: 0;
}

.insp-node-picker__trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  min-width: 0;
  overflow: hidden;
  box-sizing: border-box;
  padding: 8px 10px;
  border: 1px solid var(--canvas-border);
  border-radius: 10px;
  background: var(--canvas-input-bg);
  color: var(--canvas-text);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.insp-node-picker__trigger-label {
  flex: 1 1 0;
  min-width: 0;
  max-width: var(--insp-node-picker-label-max-width);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.insp-node-picker__trigger-chevron {
  flex: 0 0 auto;
  color: var(--canvas-text-muted);
}

.insp-node-picker__panel {
  position: absolute;
  left: 0;
  right: 0;
  top: calc(100% + 4px);
  z-index: 10;
  display: grid;
  gap: 6px;
  padding: 8px;
  border: 1px solid var(--canvas-border);
  border-radius: 12px;
  background: var(--canvas-surface);
  box-shadow: var(--canvas-shadow);
}

.insp-node-picker__search {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  padding: 6px 8px;
  border: 1px solid var(--canvas-border);
  border-radius: 8px;
  background: var(--canvas-input-bg);
  color: var(--canvas-text);
  font: inherit;
  font-size: 12px;
}

.insp-node-picker__options {
  display: grid;
  gap: 4px;
  max-height: 180px;
  overflow: auto;
}

.insp-node-picker__option {
  display: block;
  width: 100%;
  min-width: 0;
  border: 0;
  border-radius: 8px;
  background: var(--canvas-floating-button-bg);
  padding: 6px 8px;
  color: var(--canvas-text);
  font-size: 12px;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
  box-sizing: border-box;
}

.insp-node-picker__option:hover {
  background: var(--canvas-floating-button-bg-hover);
}

.insp-node-picker__empty {
  margin: 0;
  padding: 6px 8px;
  color: var(--canvas-text-muted);
  font-size: 12px;
}

.node-edge-item {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 8px;
  align-items: baseline;
  padding: 6px 0;
  border-bottom: 1px solid var(--canvas-border);
}

.node-edge-item:last-child {
  border-bottom: 0;
}

.node-edge-item__side {
  font-size: 11px;
  font-weight: 600;
  color: var(--canvas-text-muted);
  white-space: nowrap;
}

.node-edge-item__info {
  display: flex;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
}

.node-edge-item__direction {
  flex: 0 0 auto;
  color: var(--canvas-accent);
  font-size: 12px;
}

.node-edge-item__node {
  flex: 1 1 0;
  min-width: 0;
  border: 0;
  background: transparent;
  padding: 0;
  font: inherit;
  font-size: 12px;
  color: var(--canvas-accent);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
  text-align: left;
}

.node-edge-item__node:hover {
  text-decoration: underline;
}

.node-edge-item__focus {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--canvas-text-muted);
  font-size: 14px;
  cursor: pointer;
  transition: background 120ms ease, color 120ms ease;
}

.node-edge-item__focus:hover {
  background: var(--canvas-floating-button-bg-hover);
  color: var(--canvas-accent);
}

.node-edge-item__label {
  flex: 0 1 auto;
  min-width: 0;
  font-size: 11px;
  color: var(--canvas-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
