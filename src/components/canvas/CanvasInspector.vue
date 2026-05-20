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
          :value="getDraftValue('x')"
          type="number"
          @input="handleNumberInput('x', $event)"
        />
      </label>
      <label>
        {{ t("fieldY") }}
        <input
          data-testid="inspector-node-y"
          :value="getDraftValue('y')"
          type="number"
          @input="handleNumberInput('y', $event)"
        />
      </label>
      <label>
        {{ t("fieldWidth") }}
        <input
          data-testid="inspector-node-width"
          :value="getDraftValue('width')"
          type="number"
          @input="handleNumberInput('width', $event)"
        />
      </label>
      <label>
        {{ t("fieldHeight") }}
        <input
          data-testid="inspector-node-height"
          :value="getDraftValue('height')"
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
          @input="handleTextInput($event)"
        />
      </label>
      <label v-if="editor.selectedNode.type === 'file'">
        {{ t("fieldFilePath") }}
        <input
          data-testid="inspector-node-file"
          :value="getDraftText()"
          @input="handleTextInput($event)"
        />
      </label>
      <label v-if="editor.selectedNode.type === 'link'">
        {{ t("fieldUrl") }}
        <input
          data-testid="inspector-node-url"
          :value="getDraftText()"
          @input="handleTextInput($event)"
        />
      </label>
      <label v-if="editor.selectedNode.type === 'group'">
        {{ t("fieldLabel") }}
        <input
          data-testid="inspector-node-label"
          :value="getDraftText()"
          @input="handleTextInput($event)"
        />
      </label>
      <button
        v-if="isMultiNodeSelection"
        class="toolbar__button toolbar__button--primary"
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
        class="toolbar__button toolbar__button--primary"
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

const isMultiNodeSelection = computed(() => props.editor.selectedNodeCount > 1)

watch(
  () => props.editor.selectedNode,
  (node) => {
    if (!node) {
      return
    }

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
  return isMultiNodeSelection.value
    ? multiNodeDraft[field]
    : props.editor.selectedNode[field]
}

function getDraftText(): string {
  if (isMultiNodeSelection.value) {
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

function handleNumberInput(field: 'height' | 'width' | 'x' | 'y', event: Event): void {
  const value = valueFromEvent(event)
  if (isMultiNodeSelection.value) {
    const numeric = Number.parseFloat(value)
    if (!Number.isNaN(numeric)) {
      multiNodeDraft[field] = numeric
    }
    return
  }

  props.editor.updateNumericNodeField(field, value)
}

function handleTextInput(event: Event): void {
  const value = valueFromEvent(event)
  if (isMultiNodeSelection.value) {
    multiNodeDraft.text = value
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
  props.editor.applySelectedNodeChanges({ ...multiNodeDraft })
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
  gap: 10px;
  margin-bottom: 18px;
  padding: 14px;
  border: 1px solid var(--canvas-border);
  border-radius: 16px;
  background: var(--canvas-inspector-section-bg);
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
