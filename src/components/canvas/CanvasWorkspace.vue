<template>
  <div class="canvas-shell">
    <header class="toolbar">
      <div class="toolbar__group">
        <button
          class="toolbar__button toolbar__button--primary"
          @click="editor.newCanvas"
        >
          New
        </button>
        <button
          class="toolbar__button"
          @click="editor.openPath"
        >
          Open Path
        </button>
        <button
          class="toolbar__button"
          @click="editor.triggerImport"
        >
          Import
        </button>
        <button
          class="toolbar__button"
          @click="editor.save"
        >
          Save
        </button>
        <button
          class="toolbar__button"
          @click="editor.exportCanvas"
        >
          Export
        </button>
      </div>
      <div class="toolbar__group">
        <button
          class="toolbar__button"
          @click="editor.addNode('text')"
        >
          Text
        </button>
        <button
          class="toolbar__button"
          @click="editor.addNode('file')"
        >
          File
        </button>
        <button
          class="toolbar__button"
          @click="editor.addNode('link')"
        >
          Link
        </button>
        <button
          class="toolbar__button"
          @click="editor.addNode('group')"
        >
          Group
        </button>
        <button
          class="toolbar__button"
          :disabled="!editor.canDelete"
          @click="editor.deleteSelection"
        >
          Delete
        </button>
      </div>
      <div class="toolbar__group">
        <button
          class="toolbar__button"
          @click="editor.zoomOut"
        >
          -
        </button>
        <button
          class="toolbar__button toolbar__button--stat"
          @click="editor.resetViewport"
        >
          {{ Math.round(editor.viewport.scale * 100) }}%
        </button>
        <button
          class="toolbar__button"
          @click="editor.zoomIn"
        >
          +
        </button>
      </div>
      <div class="toolbar__meta">
        <span>{{ editor.state.filePath || editor.suggestedFilename || "Unsaved.canvas" }}</span>
        <span>{{ editor.state.document.nodes.length }} nodes / {{ editor.state.document.edges.length }} edges</span>
        <span :class="editor.state.isDirty ? 'toolbar__dirty' : 'toolbar__saved'">
          {{ editor.state.isDirty ? "Unsaved changes" : "Saved" }}
        </span>
      </div>
    </header>

    <div class="workspace">
      <section
        ref="stageRef"
        class="stage"
        @pointerdown="editor.startPan"
      >
        <div
          class="stage__world"
          :style="{
            transform: `translate(${editor.viewport.x}px, ${editor.viewport.y}px) scale(${editor.viewport.scale})`,
          }"
        >
          <svg
            class="stage__edges"
            :viewBox="`0 0 ${editor.board.width} ${editor.board.height}`"
          >
            <g
              v-for="edge in editor.state.document.edges"
              :key="edge.id"
            >
              <path
                class="stage__edge"
                :class="{ 'stage__edge--selected': editor.state.selectedEdgeId === edge.id }"
                :d="editor.getEdgePath(edge)"
                @click.stop="editor.selectEdge(edge.id)"
              />
              <text
                v-if="edge.label"
                class="stage__edge-label"
                :x="editor.getEdgeLabelPosition(edge).x"
                :y="editor.getEdgeLabelPosition(edge).y"
                @click.stop="editor.selectEdge(edge.id)"
              >
                {{ edge.label }}
              </text>
            </g>
          </svg>

          <article
            v-for="node in editor.displayNodes"
            :key="node.id"
            class="canvas-node"
            :class="[
              `canvas-node--${node.type}`,
              { 'canvas-node--selected': editor.state.selectedNodeId === node.id },
            ]"
            :style="editor.getNodeStyle(node)"
            @click.stop="editor.selectNode(node.id)"
            @dblclick.stop="editor.activateNode(node)"
          >
            <header
              class="canvas-node__header"
              @pointerdown.stop="editor.startDrag(node, $event)"
            >
              <span>{{ editor.getNodeTitle(node) }}</span>
              <span class="canvas-node__kind">{{ node.type }}</span>
            </header>
            <div class="canvas-node__body">
              <template v-if="node.type === 'text'">
                <div class="canvas-node__content">
                  {{ node.text }}
                </div>
              </template>
              <template v-else-if="node.type === 'file'">
                <div class="canvas-node__title">
                  {{ editor.getFileName(node.file) }}
                </div>
                <div class="canvas-node__meta">
                  {{ node.file }}
                </div>
              </template>
              <template v-else-if="node.type === 'link'">
                <div class="canvas-node__title">
                  {{ node.url }}
                </div>
                <div class="canvas-node__meta">
                  Double click to open
                </div>
              </template>
              <template v-else>
                <div class="canvas-node__content">
                  {{ node.label || "Group" }}
                </div>
              </template>
            </div>
            <button
              class="canvas-node__resize"
              @pointerdown.stop="editor.startResize(node, $event)"
            />
          </article>
        </div>
      </section>

      <aside class="inspector">
        <section class="inspector__section">
          <h2>Document</h2>
          <p>{{ editor.state.filePath || "Unsaved workspace path" }}</p>
          <p>{{ editor.state.isDirty ? "Pending save" : "In sync" }}</p>
          <div
            v-if="editor.state.issues.errors.length || editor.state.issues.warnings.length"
            class="issues"
          >
            <div
              v-for="issue in [...editor.state.issues.errors, ...editor.state.issues.warnings]"
              :key="issue.code + issue.path"
            >
              <strong>{{ issue.level.toUpperCase() }}</strong>
              <span>{{ issue.message }}</span>
            </div>
          </div>
        </section>

        <section
          v-if="editor.selectedNode"
          class="inspector__section"
        >
          <h2>Node</h2>
          <label>
            X
            <input
              :value="editor.selectedNode.x"
              type="number"
              @input="editor.updateNumericNodeField('x', valueFromEvent($event))"
            />
          </label>
          <label>
            Y
            <input
              :value="editor.selectedNode.y"
              type="number"
              @input="editor.updateNumericNodeField('y', valueFromEvent($event))"
            />
          </label>
          <label>
            Width
            <input
              :value="editor.selectedNode.width"
              type="number"
              @input="editor.updateNumericNodeField('width', valueFromEvent($event))"
            />
          </label>
          <label>
            Height
            <input
              :value="editor.selectedNode.height"
              type="number"
              @input="editor.updateNumericNodeField('height', valueFromEvent($event))"
            />
          </label>
          <label v-if="'color' in editor.selectedNode">
            Color
            <input
              :value="editor.selectedNode.color || ''"
              @input="editor.updateNodeField('color', valueFromEvent($event))"
            />
          </label>
          <label v-if="editor.selectedNode.type === 'text'">
            Text
            <textarea
              :value="editor.selectedNode.text"
              @input="editor.updateNodeField('text', valueFromEvent($event))"
            />
          </label>
          <label v-if="editor.selectedNode.type === 'file'">
            File path
            <input
              :value="editor.selectedNode.file"
              @input="editor.updateNodeField('file', valueFromEvent($event))"
            />
          </label>
          <label v-if="editor.selectedNode.type === 'link'">
            URL
            <input
              :value="editor.selectedNode.url"
              @input="editor.updateNodeField('url', valueFromEvent($event))"
            />
          </label>
          <label v-if="editor.selectedNode.type === 'group'">
            Label
            <input
              :value="editor.selectedNode.label || ''"
              @input="editor.updateNodeField('label', valueFromEvent($event))"
            />
          </label>
        </section>

        <section
          v-if="editor.selectedNode"
          class="inspector__section"
        >
          <h2>Create Edge</h2>
          <label>
            Target
            <select v-model="editor.newEdgeTargetId">
              <option value="">Select target node</option>
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
            Label
            <input v-model="editor.newEdgeLabel" />
          </label>
          <label>
            From side
            <select v-model="editor.newEdgeFromSide">
              <option
                v-for="side in editor.sides"
                :key="side"
                :value="side"
              >{{ side }}</option>
            </select>
          </label>
          <label>
            To side
            <select v-model="editor.newEdgeToSide">
              <option
                v-for="side in editor.sides"
                :key="side"
                :value="side"
              >{{ side }}</option>
            </select>
          </label>
          <button
            class="toolbar__button toolbar__button--primary"
            @click="editor.createEdgeFromSelection"
          >
            Create edge
          </button>
        </section>

        <section
          v-if="editor.selectedEdge"
          class="inspector__section"
        >
          <h2>Edge</h2>
          <label>
            Label
            <input
              :value="editor.selectedEdge.label || ''"
              @input="editor.updateEdgeField('label', valueFromEvent($event))"
            />
          </label>
          <label>
            From side
            <select
              :value="editor.selectedEdge.fromSide"
              @change="editor.updateEdgeSide('fromSide', valueFromEvent($event))"
            >
              <option
                v-for="side in editor.sides"
                :key="side"
                :value="side"
              >{{ side }}</option>
            </select>
          </label>
          <label>
            To side
            <select
              :value="editor.selectedEdge.toSide"
              @change="editor.updateEdgeSide('toSide', valueFromEvent($event))"
            >
              <option
                v-for="side in editor.sides"
                :key="side"
                :value="side"
              >{{ side }}</option>
            </select>
          </label>
          <button
            class="toolbar__button"
            @click="editor.deleteSelection"
          >
            Delete edge
          </button>
        </section>
      </aside>
    </div>

    <input
      ref="fileInputRef"
      accept=".canvas,application/json"
      class="visually-hidden"
      type="file"
      @change="handleImport"
    >
  </div>
</template>

<script setup lang="ts">
import type { Plugin } from "siyuan"

import type { CanvasTabBootstrap } from "@/main"
import { useCanvasEditor } from "@/canvas/use-canvas-editor"

const props = defineProps<{
  bootstrap: CanvasTabBootstrap
  plugin: Plugin
  setTitle: (title: string) => void
}>()

const editor = useCanvasEditor(props.plugin, props.bootstrap, props.setTitle)
const fileInputRef = editor.fileInputRef
const stageRef = editor.stageRef

function valueFromEvent(event: Event): string {
  return (event.target as HTMLInputElement).value
}

async function handleImport(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) {
    return
  }

  await editor.importCanvas(file)
  input.value = ""
}
</script>

<style scoped lang="scss">
.canvas-shell {
  display: grid;
  grid-template-rows: auto 1fr;
  height: 100%;
  min-height: 100%;
  color: var(--b3-theme-on-surface);
  background:
    radial-gradient(circle at top left, rgba(196, 226, 214, 0.18), transparent 28%),
    linear-gradient(135deg, rgba(255, 245, 232, 0.95), rgba(242, 247, 243, 0.96));
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  background: rgba(255, 251, 245, 0.88);
  backdrop-filter: blur(16px);
}

.toolbar__group {
  display: inline-flex;
  gap: 8px;
}

.toolbar__meta {
  display: inline-flex;
  gap: 16px;
  margin-left: auto;
  font-size: 13px;
  color: var(--b3-theme-on-surface-light);
}

.toolbar__button {
  border: 1px solid rgba(22, 28, 20, 0.12);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.8);
  color: var(--b3-theme-on-surface);
  padding: 8px 14px;
  font-size: 13px;
  cursor: pointer;
}

.toolbar__button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.toolbar__button--primary {
  background: #16361f;
  color: #f7f3ea;
}

.toolbar__button--stat {
  min-width: 72px;
}

.toolbar__dirty {
  color: #b84f2a;
}

.toolbar__saved {
  color: #3f7a58;
}

.workspace {
  display: grid;
  grid-template-columns: 1fr 320px;
  min-height: 0;
}

.stage {
  position: relative;
  overflow: hidden;
  background-image:
    linear-gradient(rgba(17, 33, 22, 0.08) 1px, transparent 1px),
    linear-gradient(90deg, rgba(17, 33, 22, 0.08) 1px, transparent 1px);
  background-size: 32px 32px;
}

.stage__world {
  position: absolute;
  inset: 0;
  transform-origin: 0 0;
}

.stage__edges {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
}

.stage__edge {
  fill: none;
  stroke: rgba(44, 62, 48, 0.6);
  stroke-width: 2.5;
  pointer-events: stroke;
}

.stage__edge--selected {
  stroke: #b84f2a;
}

.stage__edge-label {
  font-size: 12px;
  text-anchor: middle;
  fill: #4f5d52;
  pointer-events: all;
}

.canvas-node {
  position: absolute;
  display: flex;
  flex-direction: column;
  border: 1px solid rgba(17, 33, 22, 0.1);
  border-radius: 18px;
  overflow: hidden;
  box-shadow: 0 24px 40px rgba(22, 36, 25, 0.1);
  background: rgba(255, 252, 246, 0.96);
  cursor: default;
}

.canvas-node--group {
  background: rgba(195, 221, 206, 0.4);
  border-style: dashed;
}

.canvas-node--selected {
  box-shadow: 0 0 0 2px rgba(184, 79, 42, 0.45), 0 24px 40px rgba(22, 36, 25, 0.14);
}

.canvas-node__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #4c5f53;
  background: rgba(255, 255, 255, 0.82);
  cursor: grab;
}

.canvas-node__kind {
  opacity: 0.65;
}

.canvas-node__body {
  flex: 1;
  padding: 14px 12px 18px;
  overflow: auto;
}

.canvas-node__title {
  font-weight: 600;
  line-height: 1.5;
}

.canvas-node__content {
  white-space: pre-wrap;
  line-height: 1.6;
}

.canvas-node__meta {
  margin-top: 8px;
  font-size: 12px;
  color: #6d796f;
  word-break: break-all;
}

.canvas-node__resize {
  position: absolute;
  right: 10px;
  bottom: 10px;
  width: 16px;
  height: 16px;
  border: 0;
  border-radius: 4px;
  background: rgba(22, 54, 31, 0.18);
  cursor: nwse-resize;
}

.inspector {
  overflow: auto;
  padding: 18px;
  border-left: 1px solid rgba(0, 0, 0, 0.08);
  background: rgba(250, 248, 242, 0.9);
}

.inspector__section {
  display: grid;
  gap: 10px;
  margin-bottom: 18px;
  padding: 14px;
  border: 1px solid rgba(17, 33, 22, 0.08);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.7);
}

.inspector__section h2 {
  margin: 0;
  font-size: 13px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #4c5f53;
}

.inspector__section label {
  display: grid;
  gap: 6px;
  font-size: 12px;
  color: #4f5d52;
}

.inspector__section input,
.inspector__section select,
.inspector__section textarea {
  width: 100%;
  border: 1px solid rgba(22, 28, 20, 0.12);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.92);
  padding: 9px 10px;
  font: inherit;
  color: inherit;
  box-sizing: border-box;
}

.inspector__section textarea {
  min-height: 96px;
  resize: vertical;
}

.issues {
  display: grid;
  gap: 8px;
  font-size: 12px;
}

.issues strong {
  margin-right: 6px;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}
</style>
