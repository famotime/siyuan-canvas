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
      <label>
        {{ t("fieldSourceNode") }}
        <input
          v-model="editor.newEdgeSourceQuery"
          class="inspector__control"
        >
        <select
          :value="editor.newEdgeSourceId"
          class="inspector__control"
          @change="editor.setNewEdgeSourceId(valueFromEvent($event))"
        >
          <option value="">{{ t("fieldSelectSourceNode") }}</option>
          <option
            v-for="node in editor.edgeSources"
            :key="node.id"
            :value="node.id"
          >
            {{ editor.getNodeTitle(node) }}
          </option>
        </select>
      </label>
      <label>
        {{ t("fieldTarget") }}
        <input
          v-model="editor.newEdgeTargetQuery"
          class="inspector__control"
        >
        <select
          :value="editor.newEdgeTargetId"
          class="inspector__control"
          @change="editor.setNewEdgeTargetId(valueFromEvent($event))"
        >
          <option value="">{{ t("fieldSelectTargetNode") }}</option>
          <option
            v-for="node in editor.edgeTargets"
            :key="node.id"
            :value="node.id"
          >
            {{ editor.getNodeTitle(node) }}
          </option>
        </select>
      </label>
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
      <button
        class="toolbar__button"
        @click="editor.deleteSelection"
      >
        {{ t("inspectorDeleteEdge") }}
      </button>
    </div>
  </section>
</template>

<script lang="ts">
export default { name: "CanvasInspector" }
</script>

<script setup lang="ts">
import {
  computed,
  reactive,
  watch,
} from 'vue'

const props = defineProps<{
  editor: Record<string, any>
  getSideLabel: (side: string) => string
  t: (key: string, args?: Record<string, unknown>) => string
}>()

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
</style>
