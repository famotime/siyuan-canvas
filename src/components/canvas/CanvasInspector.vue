<template>
  <section
    v-if="editor.selectedNodeCount > 1"
    class="inspector__section"
  >
    <button
      class="inspector__section-toggle"
      :title="getSectionToggleTitle('selection')"
      type="button"
      @click="editor.toggleInspectorSection('selection')"
    >
      <h2>{{ t("inspectorSelection") }}</h2>
      <span>{{ getSectionChevron('selection') }}</span>
    </button>
    <div v-if="editor.inspectorSectionState.selection">
      <p>{{ t("selectionCount", { count: editor.selectedNodeCount }) }}</p>
      <button
        class="toolbar__button"
        @click="editor.deleteSelection"
      >
        {{ t("inspectorDeleteSelectedNodes") }}
      </button>
    </div>
  </section>

  <section
    v-if="editor.selectedNode && editor.selectedNodeCount === 1"
    class="inspector__section"
  >
    <button
      class="inspector__section-toggle"
      :title="getSectionToggleTitle('node')"
      type="button"
      @click="editor.toggleInspectorSection('node')"
    >
      <h2>{{ t("inspectorNode") }}</h2>
      <span>{{ getSectionChevron('node') }}</span>
    </button>
    <div v-if="editor.inspectorSectionState.node">
      <label>
        {{ t("fieldX") }}
        <input
          :value="editor.selectedNode.x"
          type="number"
          @input="editor.updateNumericNodeField('x', valueFromEvent($event))"
        />
      </label>
      <label>
        {{ t("fieldY") }}
        <input
          :value="editor.selectedNode.y"
          type="number"
          @input="editor.updateNumericNodeField('y', valueFromEvent($event))"
        />
      </label>
      <label>
        {{ t("fieldWidth") }}
        <input
          :value="editor.selectedNode.width"
          type="number"
          @input="editor.updateNumericNodeField('width', valueFromEvent($event))"
        />
      </label>
      <label>
        {{ t("fieldHeight") }}
        <input
          :value="editor.selectedNode.height"
          type="number"
          @input="editor.updateNumericNodeField('height', valueFromEvent($event))"
        />
      </label>
      <label v-if="'color' in editor.selectedNode">
        {{ t("fieldColor") }}
        <input
          :value="editor.selectedNode.color || ''"
          @input="editor.updateNodeField('color', valueFromEvent($event))"
        />
      </label>
      <label v-if="editor.selectedNode.type === 'text'">
        {{ t("fieldText") }}
        <textarea
          :value="editor.selectedNode.text"
          @input="editor.updateNodeField('text', valueFromEvent($event))"
        />
      </label>
      <label v-if="editor.selectedNode.type === 'file'">
        {{ t("fieldFilePath") }}
        <input
          :value="editor.selectedNode.file"
          @input="editor.updateNodeField('file', valueFromEvent($event))"
        />
      </label>
      <label v-if="editor.selectedNode.type === 'link'">
        {{ t("fieldUrl") }}
        <input
          :value="editor.selectedNode.url"
          @input="editor.updateNodeField('url', valueFromEvent($event))"
        />
      </label>
      <label v-if="editor.selectedNode.type === 'group'">
        {{ t("fieldLabel") }}
        <input
          :value="editor.selectedNode.label || ''"
          @input="editor.updateNodeField('label', valueFromEvent($event))"
        />
      </label>
    </div>
  </section>

  <section
    v-if="editor.selectedNode && editor.selectedNodeCount === 1"
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
const props = defineProps<{
  editor: Record<string, unknown>
  getSideLabel: (side: string) => string
  t: (key: string) => string
}>()

function valueFromEvent(event: Event): string {
  return (event.target as HTMLInputElement).value
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

.inspector__control {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.inspector__section input,
.inspector__section select,
.inspector__section textarea {
  width: 100%;
  border: 1px solid var(--canvas-border);
  border-radius: 12px;
  background: var(--canvas-surface);
  padding: 9px 10px;
  font: inherit;
  color: inherit;
  box-sizing: border-box;
}

.inspector__section textarea {
  min-height: 96px;
  resize: vertical;
}

.toolbar__button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 7px 14px;
  border: 1px solid var(--canvas-border);
  border-radius: 12px;
  background: var(--canvas-floating-button-bg);
  color: var(--canvas-text);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s ease;
}

.toolbar__button:hover {
  background: var(--canvas-floating-button-bg-hover);
}

.toolbar__button--primary {
  background: var(--canvas-accent);
  border-color: var(--canvas-accent);
  color: #fff;
}

.toolbar__button--primary:hover {
  background: var(--canvas-accent-hover, var(--canvas-accent));
}
</style>
